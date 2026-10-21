import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TimelessDateString } from '../../../shared/types/index.js';
import {
  CPI_INDEX_CODE,
  PriceIndexNotAvailableError,
  addMonths,
  defaultPublicationDate,
  linkAmount,
  resolvePoint,
  resolveStatedBase,
  valueInBase,
  type PriceIndexBase,
  type PriceIndexSeries,
} from '../helpers/price-index.helper.js';

type HistoryFixture = {
  bases: Array<[string, TimelessDateString, number | null]>;
  values: Array<[string, number, string]>;
};

/** Real CPI history (CBS, retrieved 2026-10-21), with the same derivations the sync applies */
function loadCpiSeries(): PriceIndexSeries {
  const fixture = JSON.parse(
    readFileSync(new URL('./fixtures/cpi-history.json', import.meta.url), 'utf8'),
  ) as HistoryFixture;
  let factor = 1;
  const bases: PriceIndexBase[] = fixture.bases.map(([baseLabel, firstPeriod, coefficient]) => {
    factor *= coefficient ?? 1;
    return { baseLabel, firstPeriod, chainCoefficient: coefficient, chainedFactor: factor };
  });
  const factors = new Map(bases.map(base => [base.baseLabel, base.chainedFactor]));
  return {
    indexCode: CPI_INDEX_CODE,
    bases,
    rows: fixture.values.map(([yearMonth, value, baseLabel]) => {
      const period = `${yearMonth}-01` as TimelessDateString;
      return {
        indexCode: CPI_INDEX_CODE,
        period,
        value,
        baseLabel,
        chainedValue: value * factors.get(baseLabel)!,
        monthlyChangePct: null,
        yearlyChangePct: null,
        publishedOn: defaultPublicationDate(period),
      };
    }),
  };
}

const series = loadCpiSeries();
const date = (value: string) => value as TimelessDateString;
const round2 = (value: number) => Math.round(value * 100) / 100;

describe('period helpers', () => {
  it('adds months across year boundaries', () => {
    expect(addMonths(date('2024-11-01'), 2)).toBe('2025-01-01');
    expect(addMonths(date('2025-01-01'), -2)).toBe('2024-11-01');
    expect(addMonths(date('2024-12-01'), 0)).toBe('2024-12-01');
  });

  it('defaults publication to the 15th of the following month', () => {
    expect(defaultPublicationDate(date('2024-12-01'))).toBe('2025-01-15');
    expect(defaultPublicationDate(date('2026-09-01'))).toBe('2026-10-15');
  });
});

describe('resolvePoint', () => {
  it('KNOWN: the index becomes known the day after publication (matches the CBS calculator)', () => {
    expect(resolvePoint(series, { date: date('2025-01-14') }).period).toBe('2024-11-01');
    expect(resolvePoint(series, { date: date('2025-01-15') }).period).toBe('2024-11-01');
    const known = resolvePoint(series, { date: date('2025-01-16') });
    expect(known.period).toBe('2024-12-01');
    expect(known.value).toBe(108.4);
    expect(known.baseLabel).toBe('Average 2022');
  });

  it('KNOWN: an early publication is known from the following day', () => {
    const early: PriceIndexSeries = {
      ...series,
      rows: series.rows.map(row =>
        row.period === '2025-10-01' ? { ...row, publishedOn: date('2025-11-14') } : row,
      ),
    };
    expect(resolvePoint(series, { date: date('2025-11-15') }).period).toBe('2025-09-01');
    expect(resolvePoint(early, { date: date('2025-11-15') }).period).toBe('2025-10-01');
  });

  it('FOR_PERIOD: the index for the date month', () => {
    const row = resolvePoint(series, { date: date('2025-01-20'), mode: 'FOR_PERIOD' });
    expect(row.period).toBe('2025-01-01');
    expect(row.value).toBe(101.5);
    expect(row.baseLabel).toBe('Average 2024');
  });

  it('throws a typed error when the index is not published yet', () => {
    expect(() => resolvePoint(series, { date: date('2026-10-20'), mode: 'FOR_PERIOD' })).toThrow(
      PriceIndexNotAvailableError,
    );
    expect(() => resolvePoint(series, { date: date('1951-09-01') })).toThrow(
      PriceIndexNotAvailableError,
    );
  });
});

describe('linkAmount', () => {
  // Expected values from the official CBS calculator
  // (https://api.cbs.gov.il/index/data/calculator/120010?value=...&date=...&toDate=...)
  it.each([
    ['2025-01-10', '2026-10-10', 100, 104.53],
    ['2025-01-20', '2026-10-20', 100, 104.33],
    ['2024-12-10', '2025-01-10', 100, 99.63],
    ['1995-03-01', '2026-10-21', 1000, 2233.08],
    ['2003-07-20', '2026-10-21', 1000, 1478.49],
    ['2010-01-10', '2018-06-30', 1000, 1083.16],
    ['2015-06-20', '2024-03-03', 1000, 1118.52],
    ['1986-05-05', '2000-01-01', 1000, 5217.86],
  ])('links %s → %s like the CBS calculator', (from, to, amount, expected) => {
    const result = linkAmount(series, amount, { date: date(from) }, { date: date(to) });
    expect(round2(result.linkedAmount)).toBe(expected);
    expect(result.linkageDifference).toBeCloseTo(result.linkedAmount - amount, 10);
  });

  it('chains across a base change', () => {
    const result = linkAmount(series, 100, { date: date('2025-01-10') }, { date: date('2026-10-10') });
    expect(result.fromIndex).toMatchObject({ period: '2024-11-01', value: 108.7, baseLabel: 'Average 2022' });
    expect(result.toIndex).toMatchObject({ period: '2026-08-01', value: 105.8, baseLabel: 'Average 2024' });
    expect(result.ratio).toBeCloseTo((105.8 * 1.074) / 108.7, 12);
  });

  it('supports mixed modes per side', () => {
    const result = linkAmount(
      series,
      100,
      { date: date('2023-01-31'), mode: 'FOR_PERIOD' },
      { date: date('2025-01-16'), mode: 'KNOWN' },
    );
    expect(result.fromIndex.period).toBe('2023-01-01');
    expect(result.toIndex.period).toBe('2024-12-01');
    expect(result.ratio).toBeCloseTo(108.4 / 102.3, 12);
  });
});

describe('bases', () => {
  const dec2024 = resolvePoint(series, { date: date('2024-12-01'), mode: 'FOR_PERIOD' });

  it('expresses a month in another base', () => {
    expect(valueInBase(series, dec2024, 'Average 2022')).toBeCloseTo(108.4, 10);
    expect(valueInBase(series, dec2024, 'Average 2024')).toBeCloseTo(108.4 / 1.074, 10);
  });

  it('resolves a stated base value onto the chained scale', () => {
    expect(resolveStatedBase(series, { value: 108.4, baseLabel: 'Average 2022' })).toBeCloseTo(
      dec2024.chainedValue,
      6,
    );
    expect(() => resolveStatedBase(series, { value: 100, baseLabel: 'Average 1900' })).toThrow();
  });
});
