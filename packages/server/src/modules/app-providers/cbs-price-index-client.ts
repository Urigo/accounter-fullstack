import { Injectable, Scope } from 'graphql-modules';
import zod from 'zod';

/** CBS (Israel Central Bureau of Statistics) price-index API. Public, no key; see
 * https://www.cbs.gov.il/he/CBSNewBrand/Pages/מדדי-מחירים-באמצעות-API.aspx */
const CBS_PRICE_API_URL = 'https://api.cbs.gov.il/index/data/price';
// CBS rejects requests without a user agent (mandatory per their API docs)
const USER_AGENT = 'accounter-server (+https://github.com/Urigo/accounter-fullstack)';
const REQUEST_TIMEOUT_MS = 15_000;
const PAGE_SIZE = 1000; // CBS maximum
const MAX_PAGES = 20;

const CbsBaseValueSchema = zod.object({
  baseDesc: zod.string().min(1),
  value: zod.number(),
});

const CbsPrevBaseSchema = zod.object({
  baseDesc: zod.string().min(1),
  value: zod.number(),
  coeff: zod.number().positive(),
});

const CbsMonthSchema = zod.object({
  year: zod.number().int(),
  month: zod.number().int().min(1).max(12),
  percent: zod.number().nullable(),
  percentYear: zod.number().nullable(),
  currBase: CbsBaseValueSchema,
  prevBase: zod.array(CbsPrevBaseSchema).nullable(),
});

const CbsPriceResponseSchema = zod.object({
  month: zod
    .array(
      zod.object({
        code: zod.number().int(),
        date: zod.array(CbsMonthSchema),
      }),
    )
    .nullable(),
  paging: zod
    .object({
      next_url: zod.string().nullable(),
    })
    .nullable()
    .optional(),
});

export type CbsPriceIndexEntry = {
  indexCode: number;
  year: number;
  month: number;
  value: number;
  baseLabel: string;
  monthlyChangePct: number | null;
  yearlyChangePct: number | null;
  /** Older bases, newest first, each with the coefficient linking it to the base before it in this list (or to `baseLabel` for the first) */
  previousBases: Array<{ baseLabel: string; coefficient: number }>;
};

/**
 * Parses a `format=json` response of `/index/data/price`.
 * Throws when the payload shape drifts, so a silent API change can't feed bad data into the DB.
 */
export function parseCbsPriceResponse(json: unknown): {
  entries: CbsPriceIndexEntry[];
  nextUrl: string | null;
} {
  const parsed = CbsPriceResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Unexpected CBS price index response: ${parsed.error.message}`);
  }
  const entries: CbsPriceIndexEntry[] = [];
  for (const series of parsed.data.month ?? []) {
    for (const row of series.date) {
      entries.push({
        indexCode: series.code,
        year: row.year,
        month: row.month,
        value: row.currBase.value,
        baseLabel: row.currBase.baseDesc.trim(),
        monthlyChangePct: row.percent,
        yearlyChangePct: row.percentYear,
        previousBases: (row.prevBase ?? []).map(base => ({
          baseLabel: base.baseDesc.trim(),
          coefficient: base.coeff,
        })),
      });
    }
  }
  return { entries, nextUrl: parsed.data.paging?.next_url ?? null };
}

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class CbsPriceIndexClient {
  /**
   * Fetches index values, newest first.
   * @param options.startPeriod - first month to fetch ("YYYY-MM"); omit for the full history
   * @param options.withCoefficients - include each row's chain coefficients to older bases
   */
  public async fetchValues(
    indexCode: number,
    options: { startPeriod?: string; last?: number; withCoefficients?: boolean } = {},
  ): Promise<CbsPriceIndexEntry[]> {
    const url = new URL(CBS_PRICE_API_URL);
    url.searchParams.set('id', String(indexCode));
    url.searchParams.set('format', 'json');
    url.searchParams.set('download', 'false');
    url.searchParams.set('lang', 'en');
    url.searchParams.set('pagesize', String(PAGE_SIZE));
    if (options.startPeriod) {
      const [year, month] = options.startPeriod.split('-');
      url.searchParams.set('startPeriod', `${month}-${year}`);
    }
    if (options.last) {
      url.searchParams.set('last', String(options.last));
    }
    if (options.withCoefficients) {
      url.searchParams.set('coef', 'true');
    }

    const entries: CbsPriceIndexEntry[] = [];
    let nextUrl: string | null = url.toString();
    for (let page = 0; nextUrl && page < MAX_PAGES; page++) {
      const result = parseCbsPriceResponse(await this.fetchJson(nextUrl));
      entries.push(...result.entries);
      nextUrl = result.nextUrl;
    }
    return entries;
  }

  /**
   * Fetches the latest month together with its chain coefficients to every older base.
   */
  public async fetchLatestWithChain(indexCode: number): Promise<CbsPriceIndexEntry | null> {
    const [latest] = await this.fetchValues(indexCode, { last: 1, withCoefficients: true });
    return latest ?? null;
  }

  private async fetchJson(url: string): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(`Failed fetching CBS price index data from ${url}`, { cause: error });
    }
    if (!res.ok) {
      throw new Error(`CBS price index API responded with ${res.status} for ${url}`);
    }
    return res.json();
  }
}
