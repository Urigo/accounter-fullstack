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

/**
 * Fetches the card-breakdown drill-downs of the given rows and, on each card-debit row, sets
 * `originReference` to the card's last 4 digits and `drillDownData` to the breakdown. Rows of any
 * other drill-down type are left untouched.
 *
 * A failed fetch is logged and its rows are kept without the hint: the scrape never fails over a
 * drill-down. Each URL is fetched once.
 */
export async function enrichCardDebitRows(
  rows: readonly CardDebitDetailsRow[],
  fetchDrillDown: (drillDownUrl: string) => Promise<unknown>,
  logger: Pick<Console, 'warn'> = console,
): Promise<{ enriched: number; failed: number }> {
  const responses = new Map<string, Promise<unknown>>();
  let enriched = 0;
  let failed = 0;

  for (const row of rows) {
    const url = typeof row.drillDownUrl === 'string' ? row.drillDownUrl : '';
    if (!mayBeCardDebitDrillDown(url)) {
      continue;
    }
    let response = responses.get(url);
    if (!response) {
      response = fetchDrillDown(url).catch((error: unknown) => {
        failed++;
        logger.warn(
          `Otsar Hahayal: failed to fetch a drill-down, keeping the row without its card hint: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return null;
      });
      responses.set(url, response);
    }

    const data = await response;
    const lastFour = cardLastFourOfDrillDown(data);
    if (!lastFour) {
      continue;
    }
    row.originReference = lastFour;
    row.drillDownData = data;
    enriched++;
  }

  return { enriched, failed };
}
