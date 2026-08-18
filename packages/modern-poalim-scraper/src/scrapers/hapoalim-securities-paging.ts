/**
 * Paging for the Poalim "mytrade" order executions history.
 *
 * The endpoint caps a response at {@link MYTRADE_EXECUTIONS_PAGE_SIZE} executions
 * and returns the most recent ones in the requested window, with no flag saying it
 * truncated. A full page therefore has to be re-requested with the window's
 * ceiling pulled back to the oldest day that page reached, until a short page
 * proves the window is exhausted.
 *
 * The driver lives here, apart from the browser-driven scraper, so the walk-back
 * can be exercised without a bank session — see `__tests__`.
 */

/**
 * The most executions one response can carry. A response of exactly this length
 * means "there is probably older activity in this window", nothing more.
 */
export const MYTRADE_EXECUTIONS_PAGE_SIZE = 150;

/**
 * Backstop on the walk-back. At a full page per round this covers 3000 executions
 * in one window; anything beyond it is a runaway loop, not a portfolio.
 */
export const MYTRADE_EXECUTIONS_MAX_ROUNDS = 20;

/** A page of executions as it arrives — before the schema has vouched for it. */
export type RawExecutionsPage = {
  Account?: { Execution?: unknown[] } | null;
} | null;

export const rawExecutions = (page: RawExecutionsPage): unknown[] => {
  const executions = page?.Account?.Execution;
  return Array.isArray(executions) ? executions : [];
};

/**
 * The `YYYY-MM-DD` prefix of a .NET round-trip timestamp.
 *
 * Read off the string rather than through a `Date`: the timestamps carry Israel's
 * UTC offset, and going via a `Date` would move the calendar day by one on a
 * machine running in a western timezone — which, used as the next window's
 * ceiling, would silently skip a day of executions. Returns null for the
 * `0001-01-01` sentinel and for anything unparseable.
 */
export function calendarDay(value: unknown): string | null {
  const match = typeof value === 'string' ? /^(\d{4})-\d{2}-\d{2}/.exec(value) : null;
  if (!match || Number(match[1]) < 1900) {
    return null;
  }
  return match[0];
}

/**
 * The oldest calendar day a page of executions reached, as `YYYY-MM-DD`.
 *
 * The endpoint answers newest-first, so this is the last row's value date — but it
 * is taken as a minimum over the whole page rather than off the last row, so an
 * unsorted response cannot cut the walk-back short. Rows with no value date
 * (corporate actions that never settle) fall back to their trade date.
 */
export function oldestExecutionDay(executions: readonly unknown[]): string | null {
  let oldest: string | null = null;
  for (const execution of executions) {
    const row = execution as Record<string, unknown> | null;
    const day = calendarDay(row?.['ValueDate']) ?? calendarDay(row?.['TradeDate']);
    if (day && (oldest === null || day < oldest)) {
      oldest = day;
    }
  }
  return oldest;
}

/**
 * Identity of an execution, for dropping the rows consecutive pages share.
 *
 * The walk-back re-requests the ceiling day rather than the day before it, since
 * one day can hold both fetched and unfetched executions — so the pages overlap by
 * a day. The fields are the ones the ingestion dedup key is built from (see
 * `ON CONFLICT` in poalim-scraper-ingestion.provider.ts), so two rows that agree
 * on them are the same execution to everything downstream.
 */
export function executionIdentity(execution: unknown): string {
  const row = (execution ?? {}) as Record<string, unknown>;
  return JSON.stringify([
    row['Security'],
    row['TradeDate'],
    row['ValueDate'],
    row['SettlementDate'],
    row['TradeType'],
    row['TransactionType'],
    row['NV'],
    row['TradePrice'],
    row['NetValueTradeCurrency'],
    row['PaymentType'],
    row['PaymentDate'],
    row['ExDate'],
    row['CancelDate'],
  ]);
}

/** The window's ceiling is requested at day granularity (the API takes ddMMyyyy). */
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** A local `Date` as `YYYY-MM-DD`, for messages — `toISOString` would shift the day. */
const toLocalDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

/** `YYYY-MM-DD` back to a local `Date`, so the day survives the round trip. */
function dayToLocalDate(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year!, month! - 1, date!);
}

export type FetchAllExecutionsResult<TPage extends RawExecutionsPage> = {
  /** The first response, kept whole: it carries the envelope the merge builds on. */
  firstPage: TPage | null;
  /**
   * The error payload that ended the walk-back, from whichever round produced it.
   * Set means the window was only partly fetched, so `executions` is incomplete and
   * the caller must report this rather than the merged result — a later round
   * failing is just as fatal as the first one failing.
   */
  failedPage: TPage | null;
  /** Every distinct execution across the rounds, newest first. */
  executions: unknown[];
  /** How many requests were issued. */
  rounds: number;
  /**
   * Set when the walk-back stopped with the window still unfinished and no error
   * payload to blame — a full page it could not get past, the round cap, or a round
   * that came back with nothing. Already logged; carried for callers.
   */
  truncated?: string | undefined;
};

/**
 * Requests the window repeatedly, pulling its ceiling back over the oldest day
 * each full page reached, and returns the merged, deduplicated executions.
 *
 * Stops on a short page (the window is exhausted), on a page that could not be read
 * (an error payload lands in `failedPage`, a null response in `truncated`), when the
 * ceiling can no longer move (a single day holding a full page), and at
 * {@link MYTRADE_EXECUTIONS_MAX_ROUNDS} rounds. Every outcome other than the short
 * page leaves a reason in `failedPage` or `truncated`: a caller that ignores both
 * cannot tell a complete window from a partial one.
 */
export async function fetchAllExecutions<TPage extends RawExecutionsPage>({
  fromDate,
  toDate,
  fetchPage,
  isErrorPage = () => false,
  label = 'the account',
  warn = console.warn,
}: {
  fromDate: Date;
  toDate: Date;
  fetchPage: (window: { fromDate: Date; toDate: Date }) => Promise<TPage | null>;
  isErrorPage?: (page: TPage) => boolean;
  label?: string;
  warn?: (message: string) => void;
}): Promise<FetchAllExecutionsResult<TPage>> {
  let firstPage: TPage | null = null;
  let failedPage: TPage | null = null;
  const executions: unknown[] = [];
  const seen = new Set<string>();
  let ceiling = toDate;
  let rounds = 0;
  let truncated: string | undefined;

  for (let round = 1; round <= MYTRADE_EXECUTIONS_MAX_ROUNDS; round++) {
    rounds = round;
    const page = await fetchPage({ fromDate, toDate: ceiling });
    firstPage ??= page;
    if (!page) {
      // Round 1 returning nothing is the ordinary "no portfolio activity" answer;
      // a later round is a window left half-fetched, which has to be said out loud.
      if (round > 1) {
        truncated =
          `Securities executions for ${label} stopped after round ${round - 1}: the next request ` +
          `came back with nothing, so the window before ${toLocalDay(ceiling)} was not fetched ` +
          `(stopped at ${executions.length} executions).`;
        warn(truncated);
      }
      break;
    }

    // An error payload carries no executions. It is kept whatever round it arrives
    // on: after a good first page it would otherwise look like a finished walk-back.
    if (isErrorPage(page)) {
      failedPage = page;
      break;
    }

    const rows = rawExecutions(page);
    for (const row of rows) {
      const identity = executionIdentity(row);
      if (!seen.has(identity)) {
        seen.add(identity);
        executions.push(row);
      }
    }

    if (rows.length < MYTRADE_EXECUTIONS_PAGE_SIZE) {
      break;
    }

    const oldestDay = oldestExecutionDay(rows);
    if (!oldestDay) {
      truncated =
        `Securities executions for ${label} filled a page but carry no usable date; ` +
        `stopped at ${executions.length} executions — older activity in the window was not fetched.`;
      warn(truncated);
      break;
    }

    const nextCeiling = dayToLocalDate(oldestDay);

    // No progress: the page is a full 150 executions sitting on (or after) the day
    // the window already ends on, so re-requesting it would return the same rows.
    if (sameDay(nextCeiling, ceiling) || nextCeiling > ceiling) {
      truncated =
        `${label} has at least ${MYTRADE_EXECUTIONS_PAGE_SIZE} securities executions on ${oldestDay} — ` +
        `the endpoint cannot page past a single day, so any beyond that were not fetched.`;
      warn(truncated);
      break;
    }

    // The full page already reached the floor of the window; nothing older to ask for.
    if (nextCeiling < fromDate) {
      break;
    }

    if (round === MYTRADE_EXECUTIONS_MAX_ROUNDS) {
      truncated =
        `Securities executions for ${label} still filled a page after ${MYTRADE_EXECUTIONS_MAX_ROUNDS} rounds; ` +
        `stopped at ${executions.length} executions, fetched back to ${oldestDay} — ` +
        `request a narrower range to get the rest.`;
      warn(truncated);
      break;
    }

    ceiling = nextCeiling;
  }

  return { firstPage, failedPage, executions, rounds, truncated };
}
