import type { TimelessDateString } from '../../../shared/types/index.js';

/** CBS code of the general consumer price index (מדד המחירים לצרכן - כללי) */
export const CPI_INDEX_CODE = 120_010;

export type PriceIndexMode = 'KNOWN' | 'FOR_PERIOD';

export type PriceIndexBase = {
  baseLabel: string;
  /** First month published in this base (YYYY-MM-01) */
  firstPeriod: TimelessDateString;
  /** Coefficient linking this base to the previous (older) one; null for the oldest base */
  chainCoefficient: number | null;
  /** Product of chain coefficients down to the oldest base */
  chainedFactor: number;
};

export type PriceIndexRow = {
  indexCode: number;
  /** YYYY-MM-01 */
  period: TimelessDateString;
  /** As published, in `baseLabel` */
  value: number;
  baseLabel: string;
  /** `value` expressed in the oldest base of the series */
  chainedValue: number;
  monthlyChangePct: number | null;
  yearlyChangePct: number | null;
  /** The index is the "known" index from the day after publication */
  publishedOn: TimelessDateString;
};

export type PriceIndexSeries = {
  indexCode: number;
  /** Ordered by period, ascending (publication order) */
  rows: PriceIndexRow[];
  bases: PriceIndexBase[];
};

export type PriceIndexPoint = { date: TimelessDateString; mode?: PriceIndexMode };

export type PriceIndexLinkage = {
  amount: number;
  linkedAmount: number;
  /** linkedAmount - amount (הפרשי הצמדה); negative under deflation */
  linkageDifference: number;
  ratio: number;
  changePercent: number;
  fromIndex: PriceIndexRow;
  toIndex: PriceIndexRow;
};

export class PriceIndexNotAvailableError extends Error {
  constructor(
    public readonly indexCode: number,
    public readonly point: PriceIndexPoint,
  ) {
    super(
      `Price index ${indexCode} is not available for ${point.mode ?? 'KNOWN'} index on ${point.date}`,
    );
    this.name = 'PriceIndexNotAvailableError';
  }
}

/** "2026-09-17" → "2026-09-01" */
export function toPeriodStart(date: TimelessDateString): TimelessDateString {
  return `${date.slice(0, 7)}-01` as TimelessDateString;
}

/** "2026-09-01" → "2026-09" */
export function periodToYearMonth(period: TimelessDateString): string {
  return period.slice(0, 7);
}

export function yearMonthToPeriod(year: number, month: number): TimelessDateString {
  return `${year}-${String(month).padStart(2, '0')}-01` as TimelessDateString;
}

/** Adds (or subtracts) whole months to a YYYY-MM-01 period */
export function addMonths(period: TimelessDateString, months: number): TimelessDateString {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const index = year * 12 + (month - 1) + months;
  return yearMonthToPeriod(Math.floor(index / 12), (index % 12) + 1);
}

/**
 * CBS publishes a month's index on the 15th of the following month. This is also the rule the
 * official CBS calculator applies, so the index becomes "known" on the 16th.
 */
export function defaultPublicationDate(period: TimelessDateString): TimelessDateString {
  return `${addMonths(period, 1).slice(0, 7)}-15` as TimelessDateString;
}

/**
 * Resolves the index row a date refers to.
 * - `KNOWN` (default): the index last published before the date — the "known index" of
 *   Income Tax Ordinance s.88 and of most contracts, and what the CBS calculator uses.
 * - `FOR_PERIOD`: the index for the date's month (מדד בגין).
 */
export function resolvePoint(series: PriceIndexSeries, point: PriceIndexPoint): PriceIndexRow {
  const mode = point.mode ?? 'KNOWN';
  let row: PriceIndexRow | undefined;
  if (mode === 'FOR_PERIOD') {
    const period = toPeriodStart(point.date);
    row = series.rows.find(candidate => candidate.period === period);
  } else {
    for (const candidate of series.rows) {
      if (candidate.publishedOn < point.date && (!row || candidate.period > row.period)) {
        row = candidate;
      }
    }
  }
  if (!row) {
    throw new PriceIndexNotAvailableError(series.indexCode, { ...point, mode });
  }
  return row;
}

function getBase(series: PriceIndexSeries, baseLabel: string): PriceIndexBase {
  const base = series.bases.find(candidate => candidate.baseLabel === baseLabel);
  if (!base) {
    throw new Error(`Unknown base "${baseLabel}" for price index ${series.indexCode}`);
  }
  return base;
}

/**
 * Expresses an index value stated in a given base (e.g. a contract's "100.7 points, Average
 * 2020") on the series' chained scale, so it can be compared with any month.
 */
export function resolveStatedBase(
  series: PriceIndexSeries,
  stated: { value: number; baseLabel: string },
): number {
  return stated.value * getBase(series, stated.baseLabel).chainedFactor;
}

/** Expresses a month's index in any base of the series (e.g. Dec 2024 in "Average 2024") */
export function valueInBase(
  series: PriceIndexSeries,
  row: PriceIndexRow,
  baseLabel: string,
): number {
  return row.chainedValue / getBase(series, baseLabel).chainedFactor;
}

export function latestBase(series: PriceIndexSeries): PriceIndexBase | undefined {
  return series.bases.reduce<PriceIndexBase | undefined>(
    (latest, base) => (!latest || base.firstPeriod > latest.firstPeriod ? base : latest),
    undefined,
  );
}

/** Index change ratio between two rows, independent of the bases they were published in */
export function getRatio(from: PriceIndexRow, to: PriceIndexRow): number {
  return to.chainedValue / from.chainedValue;
}

/** Links an amount from one point to another. No rounding — callers round per their own rules */
export function linkAmount(
  series: PriceIndexSeries,
  amount: number,
  from: PriceIndexPoint,
  to: PriceIndexPoint,
): PriceIndexLinkage {
  const fromIndex = resolvePoint(series, from);
  const toIndex = resolvePoint(series, to);
  const ratio = getRatio(fromIndex, toIndex);
  const linkedAmount = amount * ratio;
  return {
    amount,
    linkedAmount,
    linkageDifference: linkedAmount - amount,
    ratio,
    changePercent: (ratio - 1) * 100,
    fromIndex,
    toIndex,
  };
}
