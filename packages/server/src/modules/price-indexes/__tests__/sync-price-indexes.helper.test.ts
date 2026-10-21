import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { parseCbsPriceResponse } from '../../app-providers/cbs-price-index-client.js';
import {
  buildSyncRows,
  computeChainFactors,
  isNextIndexDue,
  todayInIsrael,
} from '../helpers/sync-price-indexes.helper.js';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const date = (value: string) => value as TimelessDateString;

const [latest] = parseCbsPriceResponse(fixture('cbs-latest-with-coefficients.json')).entries;
const baseChangeWindow = parseCbsPriceResponse(fixture('cbs-base-change-window.json')).entries;

describe('computeChainFactors', () => {
  const chains = computeChainFactors(latest);

  it('anchors the oldest base at 1 and links each base to the previous one', () => {
    expect(chains.size).toBe(22);
    expect(chains.get('September 1951')).toEqual({ chainCoefficient: null, chainedFactor: 1 });
    expect(chains.get('January 1959')).toEqual({ chainCoefficient: 2.753, chainedFactor: 2.753 });
    expect(chains.get('Average 2024')?.chainCoefficient).toBe(1.074);
    expect(chains.get('Average 2024')!.chainedFactor / chains.get('Average 2022')!.chainedFactor).toBeCloseTo(1.074, 12);
  });

  it('matches the chained value the CBS calculator reports (mult) for Nov 2024', () => {
    // calculator: from_index_value 108.7 (Average 2022) → mult_min 39185641.14
    expect(108.7 * chains.get('Average 2022')!.chainedFactor).toBeCloseTo(39_185_641.14, 1);
  });
});

describe('isNextIndexDue', () => {
  it('waits until the 10th of the month after the next expected period', () => {
    expect(isNextIndexDue(date('2026-09-01'), date('2026-11-09'))).toBe(false);
    expect(isNextIndexDue(date('2026-09-01'), date('2026-11-10'))).toBe(true);
    expect(isNextIndexDue(date('2026-08-01'), date('2026-10-21'))).toBe(true);
    expect(isNextIndexDue(date('2026-11-01'), date('2027-01-09'))).toBe(false);
  });
});

describe('todayInIsrael', () => {
  it('uses the Israel calendar day', () => {
    expect(todayInIsrael(new Date('2026-10-14T22:30:00Z'))).toBe('2026-10-15');
    expect(todayInIsrael(new Date('2026-10-14T20:30:00Z'))).toBe('2026-10-14');
  });
});

describe('buildSyncRows', () => {
  const chains = computeChainFactors(latest);

  it('builds values in their own bases, with chained values and first periods', () => {
    const { bases, values } = buildSyncRows({
      indexCode: 120_010,
      entries: baseChangeWindow,
      chains,
      knownBases: [],
      today: date('2026-10-21'),
    });
    expect(values.map(value => [value.period, value.baseLabel, value.publishedOn])).toEqual([
      ['2025-02-01', 'Average 2024', '2025-03-15'],
      ['2025-01-01', 'Average 2024', '2025-02-15'],
      ['2024-12-01', 'Average 2022', '2025-01-15'],
      ['2024-11-01', 'Average 2022', '2024-12-15'],
    ]);
    const jan2025 = values.find(value => value.period === '2025-01-01')!;
    expect(jan2025.chainedValue).toBeCloseTo(101.5 * chains.get('Average 2024')!.chainedFactor, 6);
    expect(bases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ baseLabel: 'Average 2024', firstPeriod: '2025-01-01', chainCoefficient: 1.074 }),
        expect.objectContaining({ baseLabel: 'Average 2022', firstPeriod: '2024-11-01', chainCoefficient: 1.059 }),
      ]),
    );
  });

  it('keeps an earlier known first period of a base', () => {
    const { bases } = buildSyncRows({
      indexCode: 120_010,
      entries: baseChangeWindow,
      chains,
      knownBases: [
        { baseLabel: 'Average 2022', firstPeriod: date('2023-01-01'), chainCoefficient: 1.059, chainedFactor: chains.get('Average 2022')!.chainedFactor },
      ],
      today: date('2026-10-21'),
    });
    expect(bases.find(base => base.baseLabel === 'Average 2022')?.firstPeriod).toBe('2023-01-01');
  });

  it('records an early publication as first seen', () => {
    const { values } = buildSyncRows({
      indexCode: 120_010,
      entries: [latest],
      chains,
      knownBases: [],
      today: date('2026-10-14'),
    });
    expect(values[0]).toMatchObject({ period: '2026-09-01', publishedOn: '2026-10-14' });
  });

  it('falls back to stored bases, and fails without any chain for a base', () => {
    const stored = computeChainFactors(latest).get('Average 2024')!;
    const params = { indexCode: 120_010, entries: [latest], today: date('2026-10-21') };
    expect(
      buildSyncRows({
        ...params,
        chains: new Map(),
        knownBases: [{ baseLabel: 'Average 2024', firstPeriod: date('2025-01-01'), ...stored }],
      }).values,
    ).toHaveLength(1);
    expect(() => buildSyncRows({ ...params, chains: new Map(), knownBases: [] })).toThrow(
      /Missing chain coefficient/,
    );
  });
});
