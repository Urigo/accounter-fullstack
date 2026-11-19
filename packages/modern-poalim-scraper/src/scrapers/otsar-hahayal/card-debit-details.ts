/**
 * Card-debit details for Otsar Hahayal ILS rows.
 *
 * The bank's monthly credit card debit has a card-breakdown drill-down (type 211, response key
 * `T20C2211`) that names the debited card by its last 4 digits (`OUT-MSKART`). That is the clue
 * that ties the bank row to the card statement it settles, so it is stored as the row's
 * `originReference`.
 */

/** Drill-down type of the card-breakdown page */
export const CARD_DEBIT_DRILL_DOWN_TYPE = '211';

/** Each drill-down request is aborted after this long; its row is kept without a hint */
export const DRILL_DOWN_TIMEOUT_MS = 20_000;

/**
 * Budget for drill-downs whose URL names no type, fetched only in case they are card breakdowns:
 * at most this many requests and this much time in total, so the scrape stays well within the
 * browser's 5-minute limit. Typed card-breakdown URLs are not limited.
 */
export const UNTYPED_DRILL_DOWN_BUDGET = { maxRequests: 50, maxTotalMs: 60_000 } as const;

/** Drill-down responses that are a plain security name, never a card breakdown */
const NON_CARD_DRILL_DOWN_PATHS = ['PaperNameServiceServlet'];

/**
 * The drill-down type a drill-down URL names in its `SUGBAKA` parameter, without leading zeros,
 * or `null` when the URL names none.
 */
export function drillDownTypeOfUrl(drillDownUrl: string): string | null {
  const match = /[?&]SUGBAKA=0*(\d+)(?:&|#|$)/i.exec(drillDownUrl);
  return match?.[1] ?? null;
}

/**
 * Whether a drill-down URL may lead to a card breakdown. A URL that names another drill-down type,
 * or a page that never holds one, is skipped; a URL that names no type at all has to be fetched to
 * find out.
 */
export function mayBeCardDebitDrillDown(drillDownUrl: string): boolean {
  if (!drillDownUrl) {
    return false;
  }
  if (NON_CARD_DRILL_DOWN_PATHS.some(path => drillDownUrl.includes(path))) {
    return false;
  }
  const type = drillDownTypeOfUrl(drillDownUrl);
  return type === null || type === CARD_DEBIT_DRILL_DOWN_TYPE;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * The last 4 digits of the debited card, read from a card-breakdown (`T20C2211`) drill-down
 * response. Any other response, a breakdown of several cards, or a value that is not exactly 4
 * digits gives `null`.
 */
export function cardLastFourOfDrillDown(drillDownData: unknown): string | null {
  const breakdown = asRecord(asRecord(drillDownData)?.['T20C2211']);
  const cards = asRecord(asRecord(breakdown?.['OUT-DATA'])?.['ALL-CARDS']);
  const details = asRecord(cards?.['KARTIS-DETAILS']);
  const lastFour = details?.['OUT-MSKART'];
  if (typeof lastFour !== 'string') {
    return null;
  }
  const trimmed = lastFour.trim();
  return /^\d{4}$/.test(trimmed) ? trimmed : null;
}

/** The fields of a raw ILS row this enrichment reads and writes */
export type CardDebitDetailsRow = {
  drillDownUrl?: unknown;
  drillDownData?: unknown;
  originReference?: unknown;
};

export type EnrichCardDebitRowsOptions = {
  logger?: Pick<Console, 'warn' | 'info'>;
  untypedBudget?: { maxRequests: number; maxTotalMs: number };
  /** Clock, for tests */
  now?: () => number;
};

export type EnrichCardDebitRowsResult = {
  /** Rows given a card hint */
  enriched: number;
  /** Drill-down requests that failed or timed out */
  failed: number;
  /** Requests for URLs that named no type */
  untypedFetched: number;
  /** URLs that named no type and were not fetched, once the budget ran out */
  untypedSkipped: number;
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Fetches the card-breakdown drill-downs of the given rows and, on each card-debit row, sets
 * `originReference` to the card's last 4 digits and `drillDownData` to the breakdown, always
 * together. Rows of any other drill-down type are left untouched.
 *
 * A failed or timed-out fetch is logged and its rows are kept without the hint: the scrape never
 * fails over a drill-down. Each URL is fetched once. URLs that name no type are fetched within
 * `untypedBudget`; the rest are skipped, and the totals are logged.
 */
export async function enrichCardDebitRows(
  rows: readonly CardDebitDetailsRow[],
  fetchDrillDown: (drillDownUrl: string) => Promise<unknown>,
  options: EnrichCardDebitRowsOptions = {},
): Promise<EnrichCardDebitRowsResult> {
  const logger = options.logger ?? console;
  const budget = options.untypedBudget ?? UNTYPED_DRILL_DOWN_BUDGET;
  const now = options.now ?? Date.now;

  const responses = new Map<string, unknown>();
  const result: EnrichCardDebitRowsResult = {
    enriched: 0,
    failed: 0,
    untypedFetched: 0,
    untypedSkipped: 0,
  };
  let untypedMs = 0;
  let budgetLogged = false;

  for (const row of rows) {
    const url = typeof row.drillDownUrl === 'string' ? row.drillDownUrl : '';
    if (!mayBeCardDebitDrillDown(url)) {
      continue;
    }

    if (!responses.has(url)) {
      const untyped = drillDownTypeOfUrl(url) === null;
      if (
        untyped &&
        (result.untypedFetched >= budget.maxRequests || untypedMs >= budget.maxTotalMs)
      ) {
        result.untypedSkipped++;
        if (!budgetLogged) {
          budgetLogged = true;
          logger.warn(
            'Otsar Hahayal: drill-down budget for URLs without a type is spent; their rows are kept without a card hint',
          );
        }
        continue;
      }

      const startedAt = now();
      let data: unknown = null;
      try {
        data = await fetchDrillDown(url);
      } catch (error) {
        result.failed++;
        logger.warn(
          `Otsar Hahayal: failed to fetch a drill-down, keeping the row without its card hint: ${errorText(error)}`,
        );
      }
      if (untyped) {
        result.untypedFetched++;
        untypedMs += now() - startedAt;
      }
      responses.set(url, data);
    }

    const data = responses.get(url);
    const lastFour = cardLastFourOfDrillDown(data);
    if (!lastFour) {
      continue;
    }
    row.originReference = lastFour;
    row.drillDownData = data;
    result.enriched++;
  }

  if (result.untypedFetched > 0 || result.untypedSkipped > 0) {
    logger.info(
      `Otsar Hahayal: ${result.untypedFetched} drill-down URL(s) without a type fetched by fallback, ${result.untypedSkipped} skipped over budget`,
    );
  }
  return result;
}
