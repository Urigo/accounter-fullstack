import { describe, expect, it } from 'vitest';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import {
  calculateAssetYear,
  calculateDepreciation,
  computeDisposal,
  remainingAssetCost,
  validateAssetDisposals,
  validateDisposalKind,
  type AssetDepreciationInput,
  type AssetDisposalInput,
} from '../asset-depreciation.helper.js';

const d = (date: string) => date as TimelessDateString;

describe('calculateAssetYear without disposals', () => {
  const rates = [6, 7, 15, 25, 33, 33.33];
  const activationDates = ['2019-01-01', '2020-02-29', '2021-07-01', '2022-12-31', '2024-03-15'];
  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2030];

  it('matches calculateDepreciation for every year (no change to filed years)', () => {
    for (const rate of rates) {
      for (const activation of activationDates) {
        for (const year of years) {
          const asset: AssetDepreciationInput = {
            cost: 123_457,
            depreciationRate: rate,
            activationDate: d(activation),
          };
          const expected = calculateDepreciation(rate, 123_457, d(activation), year);
          const result = calculateAssetYear(asset, [], year);
          expect(result.yearDepreciation).toBe(expected.yearlyDepreciationAmount);
          expect(result.openingAccumulatedDepreciation).toBe(expected.pastDepreciationAmount);
          expect(result.disposedCost).toBe(0);
        }
      }
    }
  });

  it('ignores disposals dated after the requested year', () => {
    const asset: AssetDepreciationInput = {
      cost: 100_000,
      depreciationRate: 25,
      activationDate: d('2024-07-01'),
    };
    const disposal: AssetDisposalInput = {
      id: 'a',
      disposalDate: d('2026-03-01'),
      disposedCost: 100_000,
      proceeds: 0,
    };
    expect(calculateAssetYear(asset, [disposal], 2025)).toEqual(
      calculateAssetYear(asset, [], 2025),
    );
  });
});

describe('calculateAssetYear with disposals', () => {
  // ₪100,000 at 25% from 2024-07-01; a supplier refunds ₪20,000 on 2025-07-01
  const asset: AssetDepreciationInput = {
    cost: 100_000,
    depreciationRate: 25,
    activationDate: d('2024-07-01'),
  };
  const refund: AssetDisposalInput = {
    id: 'refund',
    disposalDate: d('2025-07-01'),
    disposedCost: 20_000,
    proceeds: 20_000,
  };

  it('leaves the year before the refund unchanged', () => {
    const year2024 = calculateAssetYear(asset, [refund], 2024);
    expect(year2024.yearDepreciation).toBe(12_568); // 25,000 × 184/366
    expect(year2024.additions).toBe(100_000);
    expect(year2024.disposals).toEqual([]);
  });

  it('treats a cost refund as a partial sale on the refund date', () => {
    const year2025 = calculateAssetYear(asset, [refund], 2025);

    expect(year2025.disposals).toEqual([
      {
        id: 'refund',
        disposalDate: '2025-07-01',
        disposedCost: 20_000,
        // (12,568 + 25,000 × 182/365 = 12,466) × 20%
        accumulatedDepreciation: 5007,
        netBookValue: 14_993,
        proceeds: 20_000,
        gainLoss: 5007,
      },
    ]);
    expect(year2025.openingCost).toBe(100_000);
    expect(year2025.openingAccumulatedDepreciation).toBe(12_568);
    // 12,466 before the refund + 20,000 × 183/365 = 10,027 after it
    expect(year2025.yearDepreciation).toBe(22_493);
    expect(year2025.disposedCost).toBe(20_000);
    expect(year2025.disposedAccumulatedDepreciation).toBe(5007);
    expect(year2025.closingCost).toBe(80_000);
    expect(year2025.closingAccumulatedDepreciation).toBe(30_054);
    expect(year2025.netBookValue).toBe(49_946);
  });

  it('keeps depreciating the remaining cost until it is fully depreciated', () => {
    const year2026 = calculateAssetYear(asset, [refund], 2026);
    expect(year2026.openingCost).toBe(80_000);
    expect(year2026.openingAccumulatedDepreciation).toBe(30_054);
    expect(year2026.yearDepreciation).toBe(20_000);
    expect(year2026.disposals).toEqual([]);

    const year2028 = calculateAssetYear(asset, [refund], 2028);
    expect(year2028.closingAccumulatedDepreciation).toBe(80_000);
    expect(year2028.netBookValue).toBe(0);

    const year2029 = calculateAssetYear(asset, [refund], 2029);
    expect(year2029.yearDepreciation).toBe(0);
    expect(year2029.closingCost).toBe(80_000);
  });

  it('computes a single disposal through computeDisposal', () => {
    expect(computeDisposal(asset, [refund], 'refund')?.gainLoss).toBe(5007);
    expect(computeDisposal(asset, [refund], 'missing')).toBeNull();
  });

  it('books a gain on a full sale above book value', () => {
    const sale: AssetDisposalInput = {
      id: 'sale',
      disposalDate: d('2025-12-31'),
      disposedCost: 100_000,
      proceeds: 70_000,
    };
    const result = calculateAssetYear(asset, [sale], 2025);
    // the whole year depreciates (sale on the last day): 12,568 + 25,000
    expect(result.yearDepreciation).toBe(25_000);
    expect(result.disposals[0]).toMatchObject({
      accumulatedDepreciation: 37_568,
      netBookValue: 62_432,
      gainLoss: 7568,
    });
    expect(result.closingCost).toBe(0);
    expect(result.closingAccumulatedDepreciation).toBe(0);
    expect(result.netBookValue).toBe(0);

    const after = calculateAssetYear(asset, [sale], 2026);
    expect(after.openingCost).toBe(0);
    expect(after.yearDepreciation).toBe(0);
  });

  it('books a loss on a full sale below book value', () => {
    const sale: AssetDisposalInput = {
      id: 'sale',
      disposalDate: d('2025-03-31'),
      disposedCost: 100_000,
      proceeds: 50_000,
    };
    const result = calculateAssetYear(asset, [sale], 2025);
    // Jan 1 – Mar 31 = 90 days: 25,000 × 90/365 = 6,164
    expect(result.yearDepreciation).toBe(6164);
    expect(result.disposals[0]).toMatchObject({
      accumulatedDepreciation: 18_732,
      netBookValue: 81_268,
      gainLoss: -31_268,
    });
  });

  it('writes off a fully depreciated asset with no gain or loss', () => {
    const oldAsset: AssetDepreciationInput = {
      cost: 10_000,
      depreciationRate: 33,
      activationDate: d('2019-01-01'),
    };
    const writeOff: AssetDisposalInput = {
      id: 'scrap',
      disposalDate: d('2025-05-01'),
      disposedCost: 10_000,
      proceeds: 0,
    };
    const result = calculateAssetYear(oldAsset, [writeOff], 2025);
    expect(result.openingAccumulatedDepreciation).toBe(10_000);
    expect(result.yearDepreciation).toBe(0);
    expect(result.disposals[0]).toMatchObject({
      accumulatedDepreciation: 10_000,
      netBookValue: 0,
      gainLoss: 0,
    });
    expect(result.closingCost).toBe(0);
  });

  it('handles a disposal in the activation year', () => {
    const newAsset: AssetDepreciationInput = {
      cost: 36_500,
      depreciationRate: 10,
      activationDate: d('2025-01-01'),
    };
    const sale: AssetDisposalInput = {
      id: 'sale',
      disposalDate: d('2025-04-10'),
      disposedCost: 36_500,
      proceeds: 36_000,
    };
    const result = calculateAssetYear(newAsset, [sale], 2025);
    // Jan 1 – Apr 10 = 100 days: 3,650 × 100/365 = 1,000
    expect(result.additions).toBe(36_500);
    expect(result.openingCost).toBe(0);
    expect(result.yearDepreciation).toBe(1000);
    expect(result.disposals[0]).toMatchObject({
      accumulatedDepreciation: 1000,
      netBookValue: 35_500,
      gainLoss: 500,
    });
  });

  it('handles two partial disposals in the same year', () => {
    const twoRefunds: AssetDisposalInput[] = [
      { id: 'b', disposalDate: d('2025-10-01'), disposedCost: 40_000, proceeds: 40_000 },
      refund,
    ];
    const result = calculateAssetYear(asset, twoRefunds, 2025);
    expect(result.disposals.map(disposal => disposal.id)).toEqual(['refund', 'b']);
    expect(result.disposals[0].accumulatedDepreciation).toBe(5007);
    expect(result.disposedCost).toBe(60_000);
    expect(result.closingCost).toBe(40_000);
    expect(result.closingAccumulatedDepreciation).toBe(
      result.openingAccumulatedDepreciation +
        result.yearDepreciation -
        result.disposedAccumulatedDepreciation,
    );
    expect(remainingAssetCost(asset, twoRefunds)).toBe(40_000);
  });
});

describe('validateAssetDisposals', () => {
  const asset = { cost: 100_000, activationDate: d('2024-07-01') };

  it('accepts valid disposals', () => {
    expect(
      validateAssetDisposals(asset, [
        { id: 'a', disposalDate: d('2025-07-01'), disposedCost: 20_000, proceeds: 20_000 },
        { id: 'b', disposalDate: d('2026-07-01'), disposedCost: 80_000, proceeds: 1000 },
      ]),
    ).toEqual([]);
  });

  it('rejects a disposal before activation', () => {
    expect(
      validateAssetDisposals(asset, [
        { id: 'a', disposalDate: d('2024-06-30'), disposedCost: 1000, proceeds: 0 },
      ]),
    ).toHaveLength(1);
  });

  it('rejects disposing of more than the cost, or after a full disposal', () => {
    const errors = validateAssetDisposals(asset, [
      { id: 'a', disposalDate: d('2025-01-01'), disposedCost: 100_000, proceeds: 0 },
      { id: 'b', disposalDate: d('2025-02-01'), disposedCost: 1, proceeds: 0 },
    ]);
    expect(errors.some(error => error.includes('fully disposed'))).toBe(true);
    expect(errors.some(error => error.includes('exceeds'))).toBe(true);
  });

  it('rejects non-positive amounts and an asset without cost', () => {
    expect(
      validateAssetDisposals(asset, [
        { id: 'a', disposalDate: d('2025-01-01'), disposedCost: 0, proceeds: -1 },
      ]),
    ).toHaveLength(2);
    expect(validateAssetDisposals({ ...asset, cost: 0 }, [])).toHaveLength(1);
  });
});

describe('validateDisposalKind', () => {
  it('requires refund proceeds to equal the refunded cost, and a charge', () => {
    expect(
      validateDisposalKind({
        type: 'COST_REFUND',
        disposedCost: 20_000,
        proceeds: 20_000,
        chargeId: 'c',
      }),
    ).toEqual([]);
    expect(
      validateDisposalKind({ type: 'COST_REFUND', disposedCost: 20_000, proceeds: 1 }),
    ).toHaveLength(2);
  });

  it('requires a charge for a sale', () => {
    expect(validateDisposalKind({ type: 'SALE', disposedCost: 1, proceeds: 5 })).toHaveLength(1);
  });

  it('allows a write-off without a charge, but not with proceeds', () => {
    expect(validateDisposalKind({ type: 'WRITE_OFF', disposedCost: 1, proceeds: 0 })).toEqual([]);
    expect(validateDisposalKind({ type: 'WRITE_OFF', disposedCost: 1, proceeds: 3 })).toHaveLength(
      1,
    );
  });
});
