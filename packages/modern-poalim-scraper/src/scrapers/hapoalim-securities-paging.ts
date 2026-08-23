/**
 * Paging for the Poalim "mytrade" order executions history.
 *
 * The endpoint pages with an opaque cursor: every response carries
 * `Account.PageState`, and a non-null value means there is more to fetch. The next
 * request repeats the *same* date window and hands the cursor back as a `pageState`
 * query param. Row counts say nothing — a short page can still have a cursor, and a
 * long one can be the last.
 *
 * The driver lives here, apart from the browser-driven scraper, so the paging can be
 * exercised without a bank session — see `__tests__`.
 */

/**
 * Backstop on the paging loop. A cursor page can hold anything from one execution to
 * a few hundred, so this is not a record budget — it only catches a cursor that never
 * goes null, which is a runaway loop rather than a portfolio. Each round costs a full
 * browser tab and SPA boot, so the loop must stay bounded.
 */
export const MYTRADE_EXECUTIONS_MAX_ROUNDS = 100;

/** A page of executions as it arrives — before the schema has vouched for it. */
export type RawExecutionsPage = {
  Account?: { Execution?: unknown[]; PageState?: string | null | undefined } | null;
} | null;

export const rawExecutions = (page: RawExecutionsPage): unknown[] => {
  const executions = page?.Account?.Execution;
  return Array.isArray(executions) ? executions : [];
};

/**
 * The cursor for the next round, or null when the window is exhausted.
 *
 * The bank's value is an opaque base64 blob — never parsed, only handed back verbatim
 * on the next request. A missing or empty value counts as exhausted.
 */
function pageCursor(page: RawExecutionsPage): string | null {
  const cursor = page?.Account?.PageState;
  return typeof cursor === 'string' && cursor.trim() !== '' ? cursor : null;
}

/**
 * Identity of an execution, for dropping any rows consecutive pages share.
 *
 * The cursor should hand back each execution once, so this is a safety net rather than
 * load-bearing. The fields are the ones the ingestion dedup key is built from (see
 * `ON CONFLICT` in poalim-scraper-ingestion.provider.ts), so two rows that agree on
 * them are the same execution to everything downstream.
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

export type FetchAllExecutionsResult<TPage extends RawExecutionsPage> = {
  /** The first response, kept whole: it carries the envelope the merge builds on. */
  firstPage: TPage | null;
  /**
   * The error payload that ended the paging, from whichever round produced it.
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
   * Set when paging stopped with a cursor still open and no error payload to blame —
   * a cursor that stopped advancing, the round cap, or a round that came back with
   * nothing. Already logged; carried for callers.
   */
  truncated?: string | undefined;
};

/**
 * Requests the window repeatedly, following `Account.PageState` until it comes back
 * null, and returns the merged, deduplicated executions.
 *
 * The date window is fixed: every round asks for the same `fromDate`/`toDate` and only
 * the cursor moves. Stops on a null cursor (the window is exhausted), on a page that
 * could not be read (an error payload lands in `failedPage`, a null response in
 * `truncated`), on a cursor that repeats itself, and at
 * {@link MYTRADE_EXECUTIONS_MAX_ROUNDS} rounds. Every outcome other than the null
 * cursor leaves a reason in `failedPage` or `truncated`: a caller that ignores both
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
  fetchPage: (request: {
    fromDate: Date;
    toDate: Date;
    pageState?: string;
  }) => Promise<TPage | null>;
  isErrorPage?: (page: TPage) => boolean;
  label?: string;
  warn?: (message: string) => void;
}): Promise<FetchAllExecutionsResult<TPage>> {
  let firstPage: TPage | null = null;
  let failedPage: TPage | null = null;
  const executions: unknown[] = [];
  const seen = new Set<string>();
  let pageState: string | undefined;
  let rounds = 0;
  let truncated: string | undefined;

  for (let round = 1; round <= MYTRADE_EXECUTIONS_MAX_ROUNDS; round++) {
    rounds = round;
    const page = await fetchPage({ fromDate, toDate, ...(pageState ? { pageState } : {}) });
    firstPage ??= page;
    if (!page) {
      // Round 1 returning nothing is the ordinary "no portfolio activity" answer;
      // a later round is a window left half-fetched, which has to be said out loud.
      if (round > 1) {
        truncated =
          `Securities executions for ${label} stopped after round ${round - 1}: the next request ` +
          `came back with nothing while the paging cursor was still open ` +
          `(stopped at ${executions.length} executions).`;
        warn(truncated);
      }
      break;
    }

    // An error payload carries no executions. It is kept whatever round it arrives
    // on: after a good first page it would otherwise look like a finished walk.
    if (isErrorPage(page)) {
      failedPage = page;
      break;
    }

    for (const row of rawExecutions(page)) {
      const identity = executionIdentity(row);
      if (!seen.has(identity)) {
        seen.add(identity);
        executions.push(row);
      }
    }

    const nextPageState = pageCursor(page);

    // The window is exhausted. This is the normal exit, whatever the row count was.
    if (nextPageState === null) {
      break;
    }

    // The cursor is not moving, so the next round would return the same page.
    if (nextPageState === pageState) {
      truncated =
        `Securities executions for ${label} stopped after round ${round}: the endpoint returned ` +
        `the same paging cursor twice, so it is not advancing ` +
        `(stopped at ${executions.length} executions).`;
      warn(truncated);
      break;
    }

    if (round === MYTRADE_EXECUTIONS_MAX_ROUNDS) {
      truncated =
        `Securities executions for ${label} were still paging after ${MYTRADE_EXECUTIONS_MAX_ROUNDS} ` +
        `rounds; stopped at ${executions.length} executions — request a narrower range to get the rest.`;
      warn(truncated);
      break;
    }

    pageState = nextPageState;
  }

  return { firstPage, failedPage, executions, rounds, truncated };
}
