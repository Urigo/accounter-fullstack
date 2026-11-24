import { describe, expect, it } from 'vitest';
import { addDaysToTimelessDate, getTimelessDateYear } from '../../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import {
  calculateAssetYear,
  calculateDepreciation,
  computeCostRefund,
  computeDisposal,
  depreciationEndDate,
  remainingAssetCost,
  validateAssetDisposals,
  validateDisposalKind,
  type AssetDepreciationInput,
  type AssetDisposalInput,
} from '../asset-depreciation.helper.js';

const d = (date: string) => date as TimelessDateString;

/**
 * The end date the provider used to select from SQL before the end-date rule moved to TypeScript:
 * `(activation_date + (CONCAT((100 / percentage * 365)::text, ' day'))::interval)::date`. The
 * fractional day of the interval becomes a time of day, which the `::date` cast drops, so it is
 * activation + floor(100/rate × 365) days.
 */
const oldSqlEndDate = (rate: number, activationDate: TimelessDateString) =>
  addDaysToTimelessDate(activationDate, Math.floor((100 / rate) * 365));

describe('calculateAssetYear without disposals', () => {
  const rates = [6, 7, 15, 25, 33, 33.33];
  const activationDates = ['2019-01-01', '2020-02-29', '2021-07-01', '2022-12-31', '2024-03-15'];
  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2030, 2040];

  it('matches calculateDepreciation for every year, and is fully depreciated after the end year', () => {
    for (const rate of rates) {
      for (const activation of activationDates) {
        const endYear = getTimelessDateYear(depreciationEndDate(rate, d(activation))!);
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
          expect(result.refundedCost).toBe(0);
          expect(result.depreciationCorrection).toBe(0);
          if (year > endYear) {
            // the accumulated depreciation carries over the end year's closing balance
            expect(result.openingAccumulatedDepreciation).toBe(123_457);
            expect(result.yearDepreciation).toBe(0);
            expect(result.netBookValue).toBe(0);
          }
        }
      }
    }
  });

  it('keeps the numbers of the years up to the end year (filed years)', () => {
    // ₪100,000 at 25% from 2024-07-01, as calculated before the disposal engine changes
    const activationDate = d('2024-07-01');
    // [yearly depreciation, past depreciation] for each year from 2024 to the end year
    const yearly = (endYear: number, expirationDate?: TimelessDateString) =>
      Array.from({ length: endYear - 2023 }, (_, index) => {
        const year = calculateDepreciation(
          25,
          100_000,
          activationDate,
          2024 + index,
          expirationDate,
        );
        return [year.yearlyDepreciationAmount, year.pastDepreciationAmount];
      });

    // the end date, as the DB used to store it and as derived from the rate: 2028-06-30
    expect(oldSqlEndDate(25, activationDate)).toBe('2028-06-30');
    expect(depreciationEndDate(25, activationDate)).toBe('2028-06-30');
    const filed = [
      [12_568, 0],
      [25_000, 12_568],
      [25_000, 37_568],
      [25_000, 62_568],
      [12_432, 87_568],
    ];
    expect(yearly(2028, d('2028-06-30'))).toEqual(filed);
    expect(yearly(2028)).toEqual(filed);
  });

  it('carries the end-year balance when the end date is before the activation year', () => {
    expect(calculateDepreciation(25, 100_000, d('2024-07-01'), 2026, d('2023-06-30'))).toEqual({
      yearlyDepreciationAmount: 0,
      yearlyDepreciationRate: 0,
      pastDepreciationAmount: 0,
    });
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

describe('calculateAssetYear with sales and write-offs', () => {
  // ₪100,000 at 25% from 2024-07-01; a fifth of it is sold for ₪20,000 on 2025-07-01
  const asset: AssetDepreciationInput = {
    cost: 100_000,
    depreciationRate: 25,
    activationDate: d('2024-07-01'),
  };
  const partialSale: AssetDisposalInput = {
    id: 'partial',
    kind: 'SALE',
    disposalDate: d('2025-07-01'),
    disposedCost: 20_000,
    proceeds: 20_000,
  };

  it('leaves the year before the sale unchanged', () => {
    const year2024 = calculateAssetYear(asset, [partialSale], 2024);
    expect(year2024.yearDepreciation).toBe(12_568); // 25,000 × 184/366
    expect(year2024.additions).toBe(100_000);
    expect(year2024.disposals).toEqual([]);
  });

  it('books a partial sale on its date', () => {
    const year2025 = calculateAssetYear(asset, [partialSale], 2025);

    expect(year2025.disposals).toEqual([
      {
        id: 'partial',
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
    // 12,466 before the sale + 20,000 × 183/365 = 10,027 after it
    expect(year2025.yearDepreciation).toBe(22_493);
    expect(year2025.disposedCost).toBe(20_000);
    expect(year2025.disposedAccumulatedDepreciation).toBe(5007);
    expect(year2025.closingCost).toBe(80_000);
    expect(year2025.closingAccumulatedDepreciation).toBe(30_054);
    expect(year2025.netBookValue).toBe(49_946);
  });

  it('keeps depreciating the remaining cost until it is fully depreciated', () => {
    const year2026 = calculateAssetYear(asset, [partialSale], 2026);
    expect(year2026.openingCost).toBe(80_000);
    expect(year2026.openingAccumulatedDepreciation).toBe(30_054);
    expect(year2026.yearDepreciation).toBe(20_000);
    expect(year2026.disposals).toEqual([]);

    const year2028 = calculateAssetYear(asset, [partialSale], 2028);
    expect(year2028.closingAccumulatedDepreciation).toBe(80_000);
    expect(year2028.netBookValue).toBe(0);

    const year2029 = calculateAssetYear(asset, [partialSale], 2029);
    expect(year2029.yearDepreciation).toBe(0);
    expect(year2029.closingCost).toBe(80_000);
  });

  it('computes a single disposal through computeDisposal', () => {
    expect(computeDisposal(asset, [partialSale], 'partial')?.gainLoss).toBe(5007);
    expect(computeDisposal(asset, [partialSale], 'missing')).toBeNull();
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
    const twoSales: AssetDisposalInput[] = [
      { id: 'b', disposalDate: d('2025-10-01'), disposedCost: 40_000, proceeds: 40_000 },
      partialSale,
    ];
    const result = calculateAssetYear(asset, twoSales, 2025);
    expect(result.disposals.map(disposal => disposal.id)).toEqual(['partial', 'b']);
    expect(result.disposals[0].accumulatedDepreciation).toBe(5007);
    expect(result.disposedCost).toBe(60_000);
    expect(result.closingCost).toBe(40_000);
    expect(result.closingAccumulatedDepreciation).toBe(
      result.openingAccumulatedDepreciation +
        result.yearDepreciation -
        result.disposedAccumulatedDepreciation,
    );
    expect(remainingAssetCost(asset, twoSales)).toBe(40_000);
  });
});

describe('calculateAssetYear at and after the end of depreciation', () => {
  // ₪100,000 at 25% from 2024-07-01, ending mid-year on 2028-06-30:
  // 12,568 in 2024, 25,000 in 2025–2027, the remaining 12,432 in 2028
  const asset: AssetDepreciationInput = {
    cost: 100_000,
    depreciationRate: 25,
    activationDate: d('2024-07-01'),
  };
  // ₪100,000 at 25% from 2024-01-01, ending on December 31st (2027-12-31): 25,000 a year
  const yearEndAsset: AssetDepreciationInput = { ...asset, activationDate: d('2024-01-01') };

  it('has the expected end dates', () => {
    expect(depreciationEndDate(25, asset.activationDate)).toBe('2028-06-30');
    expect(depreciationEndDate(25, yearEndAsset.activationDate)).toBe('2027-12-31');
  });

  const disposal = (
    disposalDate: string,
    disposedCost: number,
    proceeds: number,
  ): AssetDisposalInput => ({ id: 'd', disposalDate: d(disposalDate), disposedCost, proceeds });

  describe('a year after the end year', () => {
    it.each([
      ['a mid-year end date', asset, 2029],
      ['an end date on December 31st', yearEndAsset, 2028],
    ])('reports the asset fully depreciated (%s)', (_label, input, year) => {
      const result = calculateAssetYear(input, [], year);
      expect(result.openingAccumulatedDepreciation).toBe(100_000);
      expect(result.yearDepreciation).toBe(0);
      expect(result.closingAccumulatedDepreciation).toBe(100_000);
      expect(result.netBookValue).toBe(0);
    });

    it.each([
      ['a mid-year end date', asset, '2029-03-01'],
      ['an end date on December 31st', yearEndAsset, '2028-03-01'],
      [
        'an asset activated on January 1st',
        { cost: 100_000, depreciationRate: 25, activationDate: d('2020-01-01') },
        '2025-03-01',
      ],
    ])('writes off a fully depreciated asset with no gain or loss (%s)', (_label, input, date) => {
      const writeOff = disposal(date, 100_000, 0);
      const result = calculateAssetYear(input, [writeOff], getTimelessDateYear(d(date)));
      expect(result.openingAccumulatedDepreciation).toBe(100_000);
      expect(result.yearDepreciation).toBe(0);
      expect(result.disposals[0]).toMatchObject({
        accumulatedDepreciation: 100_000,
        netBookValue: 0,
        gainLoss: 0,
      });
      expect(result.closingCost).toBe(0);
      expect(result.netBookValue).toBe(0);
    });
  });

  describe('a disposal in the end year', () => {
    it.each([
      ['on a mid-year end date', asset, '2028-06-30', 12_432, 2028],
      ['after a mid-year end date', asset, '2028-09-30', 12_432, 2028],
      ['on an end date on December 31st', yearEndAsset, '2027-12-31', 25_000, 2027],
    ])(
      'depreciates the remaining value on a partial sale %s',
      (_label, input, date, endYearDepreciation, year) => {
        const sale = disposal(date, 50_000, 10_000);
        const result = calculateAssetYear(input, [sale], year);
        // as in the same year without a disposal
        expect(result.yearDepreciation).toBe(endYearDepreciation);
        expect(result.disposals[0]).toMatchObject({
          disposedCost: 50_000,
          accumulatedDepreciation: 50_000,
          netBookValue: 0,
          gainLoss: 10_000,
        });
        expect(result.closingCost).toBe(50_000);
        expect(result.closingAccumulatedDepreciation).toBe(50_000);
        expect(result.netBookValue).toBe(0);

        // nothing is left on the books afterwards
        const later = calculateAssetYear(input, [sale], 2035);
        expect(later.openingAccumulatedDepreciation).toBe(50_000);
        expect(later.yearDepreciation).toBe(0);
        expect(later.netBookValue).toBe(0);
      },
    );

    it.each([
      ['on a mid-year end date', asset, '2028-06-30', 12_432, 2028],
      ['after a mid-year end date', asset, '2028-09-30', 12_432, 2028],
      ['on an end date on December 31st', yearEndAsset, '2027-12-31', 25_000, 2027],
    ])(
      'books the proceeds as gain on a full sale %s',
      (_label, input, date, endYearDepreciation, year) => {
        const sale = disposal(date, 100_000, 10_000);
        const result = calculateAssetYear(input, [sale], year);
        expect(result.yearDepreciation).toBe(endYearDepreciation);
        expect(result.disposals[0]).toMatchObject({
          accumulatedDepreciation: 100_000,
          netBookValue: 0,
          gainLoss: 10_000,
        });
        expect(result.closingCost).toBe(0);
        expect(result.closingAccumulatedDepreciation).toBe(0);
      },
    );

    describe('when the days to the end date fall short of the remaining value', () => {
      // ₪100,000 at 10% from 2020-03-01, ending on 2030-02-28. 2020 depreciates 306/366 of a year
      // (8,361) and 2021–2029 90,000, so 2030 takes the remaining 1,639, although Jan 1 – Feb 28
      // is only 59/365 of a year (1,616)
      const tenPercent: AssetDepreciationInput = {
        cost: 100_000,
        depreciationRate: 10,
        activationDate: d('2020-03-01'),
      };

      it('has the expected end date and end-year depreciation', () => {
        expect(depreciationEndDate(10, tenPercent.activationDate)).toBe('2030-02-28');
        expect(calculateAssetYear(tenPercent, [], 2020).yearDepreciation).toBe(8361);
        expect(calculateAssetYear(tenPercent, [], 2030).yearDepreciation).toBe(1639);
      });

      it.each(['2030-02-28', '2030-03-01'])(
        'books no loss on a write-off on or after the end date (%s)',
        date => {
          const result = calculateAssetYear(tenPercent, [disposal(date, 100_000, 0)], 2030);
          expect(result.yearDepreciation).toBe(1639);
          expect(result.disposals[0]).toMatchObject({
            accumulatedDepreciation: 100_000,
            netBookValue: 0,
            gainLoss: 0,
          });
        },
      );

      it('leaves nothing on the books after a partial sale on the end date', () => {
        const sale = disposal('2030-02-28', 40_000, 1000);
        const result = calculateAssetYear(tenPercent, [sale], 2030);
        expect(result.yearDepreciation).toBe(1639);
        expect(result.disposals[0]).toMatchObject({ netBookValue: 0, gainLoss: 1000 });
        expect(result.netBookValue).toBe(0);
        expect(calculateAssetYear(tenPercent, [sale], 2033).netBookValue).toBe(0);
      });
    });

    it('depreciates the rest of a partial sale before the end date in full', () => {
      const sale = disposal('2028-03-31', 50_000, 10_000);
      const result = calculateAssetYear(asset, [sale], 2028);
      // Jan 1 – Mar 31 = 91 days: 25,000 × 91/366 = 6,216 before the sale; the remaining half
      // then takes its whole remaining value
      expect(result.disposals[0]).toMatchObject({
        accumulatedDepreciation: 46_892,
        netBookValue: 3108,
        gainLoss: 6892,
      });
      expect(result.yearDepreciation).toBe(9324);
      expect(result.closingAccumulatedDepreciation).toBe(50_000);
      expect(result.netBookValue).toBe(0);
    });
  });
});

describe('disposal amounts with agorot', () => {
  const asset = (cost: number): AssetDepreciationInput => ({
    cost,
    depreciationRate: 25,
    activationDate: d('2024-07-01'),
  });

  it('fully disposes of an asset whose cost rounds down', () => {
    const full = { id: 'f', disposalDate: d('2025-12-31'), disposedCost: 100_000.4, proceeds: 0 };
    expect(validateAssetDisposals(asset(100_000.4), [full])).toEqual([]);
    expect(remainingAssetCost(asset(100_000.4), [full])).toBe(0);
    const result = calculateAssetYear(asset(100_000.4), [full], 2025);
    expect(result.disposedCost).toBe(100_000);
    expect(result.closingCost).toBe(0);
  });

  it('fully disposes of an asset whose cost rounds up', () => {
    const full = { id: 'f', disposalDate: d('2025-12-31'), disposedCost: 100_000.6, proceeds: 0 };
    expect(validateAssetDisposals(asset(100_000.6), [full])).toEqual([]);
    expect(remainingAssetCost(asset(100_000.6), [full])).toBe(0);
    const result = calculateAssetYear(asset(100_000.6), [full], 2025);
    expect(result.disposedCost).toBe(100_001);
    expect(result.closingCost).toBe(0);
    expect(result.netBookValue).toBe(0);
    // nothing can be disposed of afterwards
    expect(
      validateAssetDisposals(asset(100_000.6), [
        full,
        { id: 'g', disposalDate: d('2026-01-31'), disposedCost: 0.4, proceeds: 0 },
      ]),
    ).toContain('Disposed cost must be at least 1 (amounts are rounded to whole shekels)');
  });

  it('rounds the disposed cost of a partial sale, and keeps the agorot of its proceeds', () => {
    const sale = {
      id: 'r',
      disposalDate: d('2025-07-01'),
      disposedCost: 33_333.33,
      proceeds: 33_333.33,
    };
    const result = computeDisposal(asset(100_000), [sale], 'r');
    // accumulated at the sale: 12,568 + 12,466 = 25,034; the slice takes 25,034 × 33,333/100,000
    expect(result).toMatchObject({
      disposedCost: 33_333,
      accumulatedDepreciation: 8345,
      netBookValue: 24_988,
      proceeds: 33_333.33,
    });
    // the agorot of the proceeds carry into the gain: 33,333.33 − 24,988
    expect(result?.gainLoss).toBeCloseTo(8345.33, 2);
    const year = calculateAssetYear(asset(100_000), [sale], 2025);
    expect(year.closingCost).toBe(66_667);
    expect(Number.isInteger(year.netBookValue)).toBe(true);
    expect(remainingAssetCost(asset(100_000), [sale])).toBe(66_667);
  });

  it('rounds the refunded amount of a cost refund', () => {
    const refund: AssetDisposalInput = {
      id: 'r',
      kind: 'COST_REFUND',
      refundMode: 'FROM_REFUND_DATE',
      disposalDate: d('2025-07-01'),
      disposedCost: 33_333.33,
      proceeds: 0,
    };
    expect(computeCostRefund(asset(100_000), [refund], 'r')).toMatchObject({
      costReduction: 33_333,
      excessIncome: 0,
    });
    const year = calculateAssetYear(asset(100_000), [refund], 2025);
    expect(year.refundedCost).toBe(33_333);
    expect(year.closingCost).toBe(66_667);
    expect(remainingAssetCost(asset(100_000), [refund])).toBe(66_667);
    expect(validateAssetDisposals(asset(100_000), [refund])).toEqual([]);
  });

  it('keeps the agorot of a sale price in the proceeds and the gain', () => {
    const sale = {
      id: 's',
      disposalDate: d('2025-12-31'),
      disposedCost: 100_000,
      proceeds: 70_000.45,
    };
    const result = computeDisposal(asset(100_000), [sale], 's');
    expect(result).toMatchObject({
      disposedCost: 100_000,
      accumulatedDepreciation: 37_568,
      netBookValue: 62_432,
      proceeds: 70_000.45,
    });
    expect(result?.gainLoss).toBeCloseTo(7568.45, 2);
    expect(validateAssetDisposals(asset(100_000), [sale])).toEqual([]);
  });

  it('says that the totals are rounded when they exceed the cost', () => {
    expect(
      validateAssetDisposals(asset(100_000.4), [
        { id: 'a', disposalDate: d('2025-01-01'), disposedCost: 60_000.4, proceeds: 0 },
        { id: 'b', disposalDate: d('2025-02-01'), disposedCost: 40_000.6, proceeds: 0 },
      ]),
    ).toEqual([
      "Disposed cost (100001) exceeds the asset's cost (100000), both rounded to whole shekels",
    ]);
  });

  describe('several disposals (rounded cumulatively)', () => {
    const refund = (id: string, disposalDate: string, amount: number): AssetDisposalInput => ({
      id,
      disposalDate: d(disposalDate),
      disposedCost: amount,
      proceeds: amount,
    });

    it('closes an asset refunded in thirds at 0', () => {
      const thirds = [
        refund('a', '2025-03-01', 33_333.33),
        refund('b', '2025-06-01', 33_333.33),
        refund('c', '2025-09-01', 33_333.34),
      ];
      expect(validateAssetDisposals(asset(100_000), thirds)).toEqual([]);
      const result = calculateAssetYear(asset(100_000), thirds, 2025);
      // round(33,333.33) = 33,333; round(66,666.66) − 33,333 = 33,334; 100,000 − 66,667 = 33,333
      expect(result.disposals.map(disposal => disposal.disposedCost)).toEqual([
        33_333, 33_334, 33_333,
      ]);
      expect(result.disposedCost).toBe(100_000);
      expect(result.closingCost).toBe(0);
      expect(result.closingAccumulatedDepreciation).toBe(0);
      expect(result.netBookValue).toBe(0);
      expect(remainingAssetCost(asset(100_000), thirds)).toBe(0);
      // proceeds are kept as given
      expect(result.disposals.map(disposal => disposal.proceeds)).toEqual([
        33_333.33, 33_333.33, 33_333.34,
      ]);
    });

    it('accepts a split whose halves round up and down, and closes at 0', () => {
      const halves = [refund('a', '2025-03-01', 50_000.5), refund('b', '2025-09-01', 49_999.5)];
      expect(validateAssetDisposals(asset(100_000), halves)).toEqual([]);
      const result = calculateAssetYear(asset(100_000), halves, 2025);
      expect(result.disposals.map(disposal => disposal.disposedCost)).toEqual([50_001, 49_999]);
      expect(result.closingCost).toBe(0);
      expect(result.netBookValue).toBe(0);
      expect(remainingAssetCost(asset(100_000), halves)).toBe(0);
    });

    it('does not change an earlier disposal or its year when a later one is added', () => {
      const first = refund('a', '2025-07-01', 33_333.33);
      const later = refund('b', '2026-03-01', 50_000.5);
      expect(computeDisposal(asset(100_000), [first, later], 'a')).toEqual(
        computeDisposal(asset(100_000), [first], 'a'),
      );
      expect(calculateAssetYear(asset(100_000), [first, later], 2025)).toEqual(
        calculateAssetYear(asset(100_000), [first], 2025),
      );
      // 83,333.83 rounds to 83,334, so the later slice is 50,001
      expect(computeDisposal(asset(100_000), [first, later], 'b')?.disposedCost).toBe(50_001);
      expect(remainingAssetCost(asset(100_000), [first, later])).toBe(16_666);
    });
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
    expect(
      validateAssetDisposals(asset, [
        { id: 'a', disposalDate: d('2025-01-01'), disposedCost: -5, proceeds: 0 },
        { id: 'b', disposalDate: d('2025-01-02'), disposedCost: Number.NaN, proceeds: 0 },
      ]),
    ).toEqual(['Disposed cost must be positive', 'Disposed cost must be positive']);
    expect(validateAssetDisposals({ ...asset, cost: 0 }, [])).toHaveLength(1);
  });

  it('does not let an invalid amount shift the slices of later disposals', () => {
    // without the NaN taking a slice, 0.4 + 0.4 = 0.8 rounds to a 1-shekel slice
    expect(
      validateAssetDisposals(asset, [
        { id: 'a', disposalDate: d('2025-01-01'), disposedCost: 0.4, proceeds: 0 },
        { id: 'b', disposalDate: d('2025-01-02'), disposedCost: Number.NaN, proceeds: 0 },
        { id: 'c', disposalDate: d('2025-01-03'), disposedCost: 0.4, proceeds: 0 },
      ]),
    ).toEqual([
      'Disposed cost must be at least 1 (amounts are rounded to whole shekels)',
      'Disposed cost must be positive',
    ]);
  });
});


describe('validateAssetDisposals with cost refunds', () => {
  const asset = { cost: 100_000, activationDate: d('2024-07-01') };
  const refund = (id: string, disposalDate: string, disposedCost: number): AssetDisposalInput => ({
    id,
    kind: 'COST_REFUND',
    disposalDate: d(disposalDate),
    disposedCost,
    proceeds: 0,
  });

  it('accepts refunds up to the cost still on the books', () => {
    expect(
      validateAssetDisposals(asset, [
        refund('a', '2025-03-01', 30_000),
        { id: 'b', kind: 'SALE', disposalDate: d('2025-07-01'), disposedCost: 50_000, proceeds: 1 },
        refund('c', '2026-03-01', 20_000),
      ]),
    ).toEqual([]);
  });

  it('rejects a refund above the cost still on the books', () => {
    expect(
      validateAssetDisposals(asset, [
        { id: 'a', kind: 'SALE', disposalDate: d('2025-07-01'), disposedCost: 90_000, proceeds: 1 },
        refund('b', '2026-03-01', 10_001),
      ]),
    ).toEqual([
      'The refunded amount (10001) exceeds the cost still on the books on 2026-03-01 (10000), both rounded to whole shekels',
    ]);
    expect(validateAssetDisposals(asset, [refund('a', '2025-03-01', 100_001)])).toHaveLength(1);
  });

  it('rejects a refund after a full refund, before activation, or of nothing', () => {
    expect(
      validateAssetDisposals(asset, [
        refund('a', '2025-03-01', 100_000),
        refund('b', '2025-04-01', 1),
      ]),
    ).toEqual([
      'The asset was fully disposed of before 2025-04-01',
      "Disposed cost (100001) exceeds the asset's cost (100000), both rounded to whole shekels",
    ]);
    expect(validateAssetDisposals(asset, [refund('a', '2024-06-30', 1000)])).toEqual([
      "Refund date 2024-06-30 is before the asset's activation date 2024-07-01",
    ]);
    expect(validateAssetDisposals(asset, [refund('a', '2025-03-01', 0.4)])).toEqual([
      'The refunded amount must be at least 1 (amounts are rounded to whole shekels)',
    ]);
  });
});

describe('validateDisposalKind', () => {
  it('requires a cost refund to have no proceeds, and a charge', () => {
    expect(validateDisposalKind({ type: 'COST_REFUND', proceeds: 0, chargeId: 'c' })).toEqual([]);
    for (const refundMode of ['FROM_ACTIVATION', 'FROM_REFUND_DATE'] as const) {
      expect(
        validateDisposalKind({ type: 'COST_REFUND', proceeds: 0, refundMode, chargeId: 'c' }),
      ).toEqual([]);
    }
    expect(
      validateDisposalKind({ type: 'COST_REFUND', disposedCost: 20_000, proceeds: 20_000 }),
    ).toEqual([
      'A cost refund has no proceeds: the refunded amount reduces the cost',
      'A cost refund must be linked to the charge that carries the refund',
    ]);
  });

  it('requires a charge for a sale', () => {
    expect(validateDisposalKind({ type: 'SALE', disposedCost: 1, proceeds: 5 })).toHaveLength(1);
    expect(validateDisposalKind({ type: 'SALE', proceeds: 5, chargeId: 'c' })).toEqual([]);
  });

  it('allows a write-off without a charge, but not with proceeds', () => {
    expect(validateDisposalKind({ type: 'WRITE_OFF', disposedCost: 1, proceeds: 0 })).toEqual([]);
    expect(validateDisposalKind({ type: 'WRITE_OFF', disposedCost: 1, proceeds: 3 })).toHaveLength(
      1,
    );
  });

  it('allows a refund mode only on a cost refund', () => {
    expect(
      validateDisposalKind({
        type: 'SALE',
        proceeds: 5,
        refundMode: 'FROM_ACTIVATION',
        chargeId: 'c',
      }),
    ).toEqual(['A refund mode applies only to a cost refund']);
    expect(
      validateDisposalKind({ type: 'WRITE_OFF', proceeds: 0, refundMode: 'FROM_REFUND_DATE' }),
    ).toEqual(['A refund mode applies only to a cost refund']);
  });
});

describe('a disposal without a kind', () => {
  const asset: AssetDepreciationInput = {
    cost: 100_000,
    depreciationRate: 25,
    activationDate: d('2024-07-01'),
  };

  it('behaves as a sale', () => {
    const disposal = {
      id: 'd',
      disposalDate: d('2025-07-01'),
      disposedCost: 20_000,
      proceeds: 20_000,
    };
    for (const year of [2025, 2026, 2028]) {
      expect(calculateAssetYear(asset, [disposal], year)).toEqual(
        calculateAssetYear(asset, [{ ...disposal, kind: 'SALE' }], year),
      );
    }
    expect(calculateAssetYear(asset, [disposal], 2025).costRefunds).toEqual([]);
  });
});

describe('cost refunds from activation', () => {
  // ₪100,000 at 25% from 2024-07-01: 12,568 in 2024 (184/366 of 25,000), 25,000 a year after
  const asset: AssetDepreciationInput = {
    cost: 100_000,
    depreciationRate: 25,
    activationDate: d('2024-07-01'),
  };
  const refund = (id: string, disposalDate: string, disposedCost: number): AssetDisposalInput => ({
    id,
    kind: 'COST_REFUND',
    refundMode: 'FROM_ACTIVATION',
    disposalDate: d(disposalDate),
    disposedCost,
    proceeds: 0,
  });

  it('leaves the years before the refund year as filed', () => {
    const events = [refund('r', '2026-03-01', 20_000)];
    for (const year of [2024, 2025]) {
      expect(calculateAssetYear(asset, events, year)).toEqual(calculateAssetYear(asset, [], year));
    }
  });

  it('recaptures the earlier years and depreciates the corrected cost from the refund year', () => {
    const events = [refund('r', '2025-03-01', 20_000)];
    const year2025 = calculateAssetYear(asset, events, 2025);
    // 2024 recomputed on 80,000: 20,000 × 184/366 = 10,055, so 12,568 − 10,055 is recaptured
    expect(year2025).toMatchObject({
      openingCost: 100_000,
      refundedCost: 20_000,
      closingCost: 80_000,
      openingAccumulatedDepreciation: 12_568,
      depreciationCorrection: 2513,
      yearDepreciation: 20_000,
      yearlyDepreciationRate: 25,
      closingAccumulatedDepreciation: 30_055,
      netBookValue: 49_945,
      disposals: [],
      costRefunds: [
        {
          id: 'r',
          refundDate: '2025-03-01',
          mode: 'FROM_ACTIVATION',
          costReduction: 20_000,
          recapture: 2513,
          excessIncome: 0,
        },
      ],
    });
    // the default mode is from activation
    expect(
      calculateAssetYear(asset, [{ ...events[0], refundMode: undefined }], 2025),
    ).toEqual(year2025);
    // later years follow the corrected cost's own schedule, the end year taking the leftover
    for (let year = 2025; year <= 2030; year++) {
      const expected = calculateDepreciation(25, 80_000, asset.activationDate, year);
      expect(calculateAssetYear(asset, events, year).yearDepreciation).toBe(
        expected.yearlyDepreciationAmount,
      );
    }
    expect(calculateAssetYear(asset, events, 2028)).toMatchObject({
      yearDepreciation: 9945,
      closingAccumulatedDepreciation: 80_000,
      netBookValue: 0,
    });
  });

  it('applies a refund in the activation year from activation, with no recapture', () => {
    const events = [refund('r', '2024-10-01', 20_000)];
    expect(calculateAssetYear(asset, events, 2024)).toMatchObject({
      openingCost: 0,
      additions: 100_000,
      refundedCost: 20_000,
      closingCost: 80_000,
      depreciationCorrection: 0,
      // 20,000 × 184/366: nothing is depreciated on the refunded part
      yearDepreciation: 10_055,
      costRefunds: [{ id: 'r', costReduction: 20_000, recapture: 0, excessIncome: 0 }],
    });
    for (let year = 2024; year <= 2029; year++) {
      const expected = calculateDepreciation(25, 80_000, asset.activationDate, year);
      const result = calculateAssetYear(asset, events, year);
      expect(result.yearDepreciation).toBe(expected.yearlyDepreciationAmount);
      expect(result.openingAccumulatedDepreciation).toBe(expected.pastDepreciationAmount);
    }
  });

  it('recomputes each refund on the schedule corrected by the earlier ones', () => {
    const events = [refund('a', '2025-05-01', 10_000), refund('b', '2026-05-01', 10_000)];
    // 2025: 12,568 − 22,500 × 184/366 (11,311); 2026: 11,311 + 22,500 − (10,055 + 20,000)
    expect(calculateAssetYear(asset, events, 2025).costRefunds[0].recapture).toBe(1257);
    expect(calculateAssetYear(asset, events, 2026).costRefunds[0].recapture).toBe(3756);
    for (let year = 2026; year <= 2030; year++) {
      const expected = calculateDepreciation(25, 80_000, asset.activationDate, year);
      const result = calculateAssetYear(asset, events, year);
      expect(result.yearDepreciation).toBe(expected.yearlyDepreciationAmount);
      expect(result.closingAccumulatedDepreciation).toBe(
        expected.pastDepreciationAmount + expected.yearlyDepreciationAmount,
      );
    }
    // two refunds in the same year come to the same as one
    const sameYear = [refund('a', '2025-03-01', 10_000), refund('b', '2025-09-01', 10_000)];
    const single = calculateAssetYear(asset, [refund('r', '2025-03-01', 20_000)], 2025);
    const twice = calculateAssetYear(asset, sameYear, 2025);
    expect(twice.depreciationCorrection).toBe(single.depreciationCorrection);
    expect(twice.closingAccumulatedDepreciation).toBe(single.closingAccumulatedDepreciation);
    expect(twice.costRefunds.map(result => result.id)).toEqual(['a', 'b']);
  });

  it('closes the asset on a full refund and recaptures all of its depreciation', () => {
    const result = calculateAssetYear(asset, [refund('r', '2026-03-01', 100_000)], 2026);
    expect(result).toMatchObject({
      openingAccumulatedDepreciation: 37_568,
      depreciationCorrection: 37_568,
      yearDepreciation: 0,
      closingCost: 0,
      closingAccumulatedDepreciation: 0,
      netBookValue: 0,
    });
  });

  it('recaptures the whole refund on a fully depreciated asset', () => {
    const old: AssetDepreciationInput = {
      cost: 10_000,
      depreciationRate: 33,
      activationDate: d('2019-01-01'),
    };
    const result = calculateAssetYear(old, [refund('r', '2025-05-01', 4000)], 2025);
    expect(result).toMatchObject({
      openingAccumulatedDepreciation: 10_000,
      depreciationCorrection: 4000,
      yearDepreciation: 0,
      closingCost: 6000,
      closingAccumulatedDepreciation: 6000,
      netBookValue: 0,
    });
  });

  it('falls back to the proportional share after a sale changed the base', () => {
    const sale: AssetDisposalInput = {
      id: 's',
      kind: 'SALE',
      disposalDate: d('2025-06-30'),
      disposedCost: 50_000,
      proceeds: 40_000,
    };
    const events = [sale, refund('r', '2026-03-01', 10_000)];
    const year2025 = calculateAssetYear(asset, events, 2025);
    const year2026 = calculateAssetYear(asset, events, 2026);
    expect(year2026.openingCost).toBe(50_000);
    expect(year2026.openingAccumulatedDepreciation).toBe(year2025.closingAccumulatedDepreciation);
    // a fifth of the remaining cost takes a fifth of its accumulated depreciation
    expect(year2026.costRefunds[0].recapture).toBe(
      Math.round(year2025.closingAccumulatedDepreciation / 5),
    );
    expect(year2026).toMatchObject({
      closingCost: 40_000,
      // the corrected cost depreciates a full year: 25% of 40,000
      yearDepreciation: 10_000,
    });
  });

  it('computes a sale after a refund on the corrected cost', () => {
    const sale: AssetDisposalInput = {
      id: 's',
      kind: 'SALE',
      disposalDate: d('2026-06-30'),
      disposedCost: 80_000,
      proceeds: 50_000,
    };
    const events = [refund('r', '2025-03-01', 20_000), sale];
    const result = calculateAssetYear(asset, events, 2026);
    // 30,055 at the start of 2026, plus 20,000 × 181/365 = 9,918 up to the sale
    expect(result).toMatchObject({
      openingCost: 80_000,
      openingAccumulatedDepreciation: 30_055,
      yearDepreciation: 9918,
      refundedCost: 0,
      disposedCost: 80_000,
      disposedAccumulatedDepreciation: 39_973,
      closingCost: 0,
      closingAccumulatedDepreciation: 0,
      costRefunds: [],
    });
    expect(computeDisposal(asset, events, 's')).toEqual({
      id: 's',
      disposalDate: '2026-06-30',
      disposedCost: 80_000,
      accumulatedDepreciation: 39_973,
      netBookValue: 40_027,
      proceeds: 50_000,
      gainLoss: 9973,
    });
    expect(computeCostRefund(asset, events, 'r')?.recapture).toBe(2513);
    expect(computeCostRefund(asset, events, 's')).toBeNull();
  });
});

describe('cost refunds from the refund date', () => {
  const asset: AssetDepreciationInput = {
    cost: 100_000,
    depreciationRate: 25,
    activationDate: d('2024-07-01'),
  };
  const refund = (id: string, disposalDate: string, disposedCost: number): AssetDisposalInput => ({
    id,
    kind: 'COST_REFUND',
    refundMode: 'FROM_REFUND_DATE',
    disposalDate: d(disposalDate),
    disposedCost,
    proceeds: 0,
  });

  it('lowers the book value on a partial refund, and keeps depreciating the reduced cost', () => {
    const events = [refund('r', '2025-07-01', 20_000)];
    expect(calculateAssetYear(asset, events, 2024)).toEqual(calculateAssetYear(asset, [], 2024));

    const year2025 = calculateAssetYear(asset, events, 2025);
    // 25,000 × 182/365 = 12,466 up to the refund, then 20,000 × 183/365 = 10,027
    expect(year2025).toMatchObject({
      openingCost: 100_000,
      refundedCost: 20_000,
      closingCost: 80_000,
      openingAccumulatedDepreciation: 12_568,
      yearDepreciation: 22_493,
      depreciationCorrection: 0,
      disposedAccumulatedDepreciation: 0,
      closingAccumulatedDepreciation: 35_061,
      netBookValue: 44_939,
      disposals: [],
      costRefunds: [
        {
          id: 'r',
          refundDate: '2025-07-01',
          mode: 'FROM_REFUND_DATE',
          costReduction: 20_000,
          recapture: 0,
          excessIncome: 0,
        },
      ],
    });

    expect(calculateAssetYear(asset, events, 2026).yearDepreciation).toBe(20_000);
    expect(calculateAssetYear(asset, events, 2027).yearDepreciation).toBe(20_000);
    // the end year (2028-06-30) takes what is left
    expect(calculateAssetYear(asset, events, 2028)).toMatchObject({
      yearDepreciation: 4939,
      closingAccumulatedDepreciation: 80_000,
      netBookValue: 0,
    });
    expect(calculateAssetYear(asset, events, 2029).yearDepreciation).toBe(0);
  });

  it('books the part of a refund above the book value as income', () => {
    const events = [refund('r', '2026-12-31', 70_000)];
    const result = calculateAssetYear(asset, events, 2026);
    // 62,568 accumulated at the refund against a cost of 30,000 after it
    expect(result).toMatchObject({
      openingAccumulatedDepreciation: 37_568,
      yearDepreciation: 25_000,
      refundedCost: 70_000,
      closingCost: 30_000,
      depreciationCorrection: 32_568,
      closingAccumulatedDepreciation: 30_000,
      netBookValue: 0,
      costRefunds: [{ id: 'r', costReduction: 70_000, recapture: 0, excessIncome: 32_568 }],
    });
    expect(computeCostRefund(asset, events, 'r')?.excessIncome).toBe(32_568);
    expect(calculateAssetYear(asset, events, 2027)).toMatchObject({
      yearDepreciation: 0,
      closingCost: 30_000,
      closingAccumulatedDepreciation: 30_000,
    });
  });

  it('splits the activation year at the refund date', () => {
    const result = calculateAssetYear(asset, [refund('r', '2024-10-01', 20_000)], 2024);
    // 25,000 × 93/366 = 6,352 up to the refund, then 20,000 × 91/366 = 4,973
    expect(result).toMatchObject({
      additions: 100_000,
      refundedCost: 20_000,
      closingCost: 80_000,
      yearDepreciation: 11_325,
      depreciationCorrection: 0,
    });
  });

  it('makes a later refund from activation fall back to the proportional share', () => {
    const events: AssetDisposalInput[] = [
      refund('a', '2025-07-01', 20_000),
      { ...refund('b', '2026-03-01', 8000), refundMode: 'FROM_ACTIVATION' },
    ];
    // 35,061 × 8,000/80,000
    expect(calculateAssetYear(asset, events, 2026).costRefunds[0]).toMatchObject({
      mode: 'FROM_ACTIVATION',
      recapture: 3506,
    });
  });
});

describe('non-depreciated (0%) assets', () => {
  // ₪100,000 at 0% from 2024-07-01, e.g. trademarks
  const asset: AssetDepreciationInput = {
    cost: 100_000,
    depreciationRate: 0,
    activationDate: d('2024-07-01'),
  };

  it('have no end date and never depreciate', () => {
    expect(depreciationEndDate(0, asset.activationDate)).toBeNull();
    for (const year of [2024, 2025, 2040]) {
      expect(calculateDepreciation(0, 100_000, asset.activationDate, year)).toEqual({
        yearlyDepreciationAmount: 0,
        yearlyDepreciationRate: 0,
        pastDepreciationAmount: 0,
      });
      expect(calculateAssetYear(asset, [], year)).toMatchObject({
        closingCost: 100_000,
        yearDepreciation: 0,
        yearlyDepreciationRate: 0,
        closingAccumulatedDepreciation: 0,
        netBookValue: 100_000,
      });
    }
  });

  it('book a sale against the full cost', () => {
    const sale: AssetDisposalInput = {
      id: 's',
      kind: 'SALE',
      disposalDate: d('2025-06-30'),
      disposedCost: 50_000,
      proceeds: 60_000,
    };
    expect(computeDisposal(asset, [sale], 's')).toMatchObject({
      accumulatedDepreciation: 0,
      netBookValue: 50_000,
      gainLoss: 10_000,
    });
    expect(calculateAssetYear(asset, [sale], 2026)).toMatchObject({
      openingCost: 50_000,
      closingCost: 50_000,
      yearDepreciation: 0,
    });
  });

  it.each(['FROM_ACTIVATION', 'FROM_REFUND_DATE'] as const)(
    'reduce the cost on a refund (%s), with no income',
    refundMode => {
      const refund: AssetDisposalInput = {
        id: 'r',
        kind: 'COST_REFUND',
        refundMode,
        disposalDate: d('2025-03-01'),
        disposedCost: 20_000,
        proceeds: 0,
      };
      expect(calculateAssetYear(asset, [refund], 2025)).toMatchObject({
        refundedCost: 20_000,
        closingCost: 80_000,
        depreciationCorrection: 0,
        yearDepreciation: 0,
        closingAccumulatedDepreciation: 0,
        netBookValue: 80_000,
        costRefunds: [{ id: 'r', mode: refundMode, recapture: 0, excessIncome: 0 }],
      });
      expect(calculateAssetYear(asset, [refund], 2030).closingCost).toBe(80_000);
    },
  );
});

describe('depreciationEndDate (C4)', () => {
  it.each([
    // whole N: activation + N calendar years − 1 day
    [12.5, '2023-08-20', '2031-08-19'],
    [10, '2023-08-20', '2033-08-19'],
    [25, '2024-07-01', '2028-06-30'],
    [25, '2024-01-01', '2027-12-31'],
    [100, '2021-01-01', '2021-12-31'],
    [50, '2020-02-29', '2022-02-27'],
    [25, '2020-02-29', '2024-02-28'],
    // fractional N: floor(N) calendar years + round(frac × 365) days − 1 day
    [33, '2023-08-20', '2026-08-30'],
    [33.33, '2021-01-01', '2023-12-31'],
    [40, '2024-07-01', '2026-12-30'],
    [15, '2020-01-01', '2026-08-31'],
    [6, '2020-01-01', '2036-08-30'],
    [7, '2020-01-01', '2034-04-14'],
  ])('rate %s from %s ends on %s', (rate, activation, expected) => {
    expect(depreciationEndDate(rate, d(activation))).toBe(expected);
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    'gives no end date for a rate of %s',
    rate => {
      expect(depreciationEndDate(rate, d('2024-01-01'))).toBeNull();
    },
  );

  describe('against the end date the DB used to compute', () => {
    const rates = [5, 6, 7, 10, 12.5, 15, 20, 25, 33, 33.33, 40, 50, 100];
    const activationDates: string[] = [];
    for (let year = 2019; year <= 2024; year++) {
      activationDates.push(`${year}-01-01`, `${year}-01-02`, `${year}-07-01`, `${year}-12-31`);
      if (year % 4 === 0) {
        activationDates.push(`${year}-02-29`);
      }
    }
    activationDates.push('2023-08-20');
    activationDates.sort();

    const cases = rates.flatMap(rate =>
      activationDates.map(activation => {
        const oldEnd = oldSqlEndDate(rate, d(activation));
        const newEnd = depreciationEndDate(rate, d(activation));
        if (!newEnd) {
          throw new Error(`No end date for ${rate}%`);
        }
        return { rate, activation: d(activation), oldEnd, newEnd };
      }),
    );

    // Whole-N rates from 2 January: the old date (365-day years) fell short of the anniversary by
    // the leap days in between, in late December; it now moves to 1 January. Short lives from
    // 1 January with no 29 February in them: the old date was the anniversary itself (1 January),
    // a day after the last day of the N years.
    it('moves the end year only for the listed cases', () => {
      const shifts = cases
        .filter(({ oldEnd, newEnd }) => getTimelessDateYear(oldEnd) !== getTimelessDateYear(newEnd))
        .map(
          ({ rate, activation, oldEnd, newEnd }) =>
            `${rate}% from ${activation}: ${oldEnd} → ${newEnd}`,
        );
      expect(shifts).toEqual([
          '5% from 2019-01-02: 2038-12-28 → 2039-01-01',
          '5% from 2020-01-02: 2039-12-28 → 2040-01-01',
          '5% from 2021-01-02: 2040-12-28 → 2041-01-01',
          '5% from 2022-01-02: 2041-12-28 → 2042-01-01',
          '5% from 2023-01-02: 2042-12-28 → 2043-01-01',
          '5% from 2024-01-02: 2043-12-28 → 2044-01-01',
          '10% from 2019-01-02: 2028-12-30 → 2029-01-01',
          '10% from 2020-01-02: 2029-12-30 → 2030-01-01',
          '10% from 2021-01-02: 2030-12-31 → 2031-01-01',
          '10% from 2022-01-02: 2031-12-31 → 2032-01-01',
          '10% from 2023-01-02: 2032-12-30 → 2033-01-01',
          '10% from 2024-01-02: 2033-12-30 → 2034-01-01',
          '12.5% from 2019-01-02: 2026-12-31 → 2027-01-01',
          '12.5% from 2020-01-02: 2027-12-31 → 2028-01-01',
          '12.5% from 2021-01-02: 2028-12-31 → 2029-01-01',
          '12.5% from 2022-01-02: 2029-12-31 → 2030-01-01',
          '12.5% from 2023-01-02: 2030-12-31 → 2031-01-01',
          '12.5% from 2024-01-02: 2031-12-31 → 2032-01-01',
          '20% from 2020-01-02: 2024-12-31 → 2025-01-01',
          '20% from 2024-01-02: 2028-12-31 → 2029-01-01',
          '33.33% from 2021-01-01: 2024-01-01 → 2023-12-31',
          '50% from 2021-01-01: 2023-01-01 → 2022-12-31',
          '50% from 2022-01-01: 2024-01-01 → 2023-12-31',
          '100% from 2019-01-01: 2020-01-01 → 2019-12-31',
          '100% from 2021-01-01: 2022-01-01 → 2021-12-31',
          '100% from 2022-01-01: 2023-01-01 → 2022-12-31',
          '100% from 2023-01-01: 2024-01-01 → 2023-12-31',
      ]);
    });

    // On ₪100,000, only these cases change any yearly amount. From 2 January, the activation
    // year misses a day, and its leftover now falls in a one-day final year; 33.33% from
    // 2021-01-01 takes its ₪10 leftover a year earlier. The 1 January cases at 50% and 100% move
    // the end year without changing any amount (the old final year had nothing left).
    it('lists the yearly amounts that move with the end year', () => {
      const moves: string[] = [];
      for (const { rate, activation, oldEnd, newEnd } of cases) {
        const lastYear = Math.max(getTimelessDateYear(oldEnd), getTimelessDateYear(newEnd)) + 1;
        for (let year = getTimelessDateYear(activation); year <= lastYear; year++) {
          const before = calculateDepreciation(rate, 100_000, activation, year, oldEnd);
          const after = calculateDepreciation(rate, 100_000, activation, year);
          if (before.yearlyDepreciationAmount !== after.yearlyDepreciationAmount) {
            moves.push(
              `${rate}% from ${activation}, ${year}: ${before.yearlyDepreciationAmount} → ${after.yearlyDepreciationAmount}`,
            );
          }
        }
      }
      expect(moves).toEqual([
          '5% from 2019-01-02, 2038: 5014 → 5000',
          '5% from 2019-01-02, 2039: 0 → 14',
          '5% from 2020-01-02, 2039: 5014 → 5000',
          '5% from 2020-01-02, 2040: 0 → 14',
          '5% from 2021-01-02, 2040: 5014 → 5000',
          '5% from 2021-01-02, 2041: 0 → 14',
          '5% from 2022-01-02, 2041: 5014 → 5000',
          '5% from 2022-01-02, 2042: 0 → 14',
          '5% from 2023-01-02, 2042: 5014 → 5000',
          '5% from 2023-01-02, 2043: 0 → 14',
          '5% from 2024-01-02, 2043: 5014 → 5000',
          '5% from 2024-01-02, 2044: 0 → 14',
          '10% from 2019-01-02, 2028: 10027 → 10000',
          '10% from 2019-01-02, 2029: 0 → 27',
          '10% from 2020-01-02, 2029: 10027 → 10000',
          '10% from 2020-01-02, 2030: 0 → 27',
          '10% from 2021-01-02, 2030: 10027 → 10000',
          '10% from 2021-01-02, 2031: 0 → 27',
          '10% from 2022-01-02, 2031: 10027 → 10000',
          '10% from 2022-01-02, 2032: 0 → 27',
          '10% from 2023-01-02, 2032: 10027 → 10000',
          '10% from 2023-01-02, 2033: 0 → 27',
          '10% from 2024-01-02, 2033: 10027 → 10000',
          '10% from 2024-01-02, 2034: 0 → 27',
          '12.5% from 2019-01-02, 2026: 12534 → 12500',
          '12.5% from 2019-01-02, 2027: 0 → 34',
          '12.5% from 2020-01-02, 2027: 12534 → 12500',
          '12.5% from 2020-01-02, 2028: 0 → 34',
          '12.5% from 2021-01-02, 2028: 12534 → 12500',
          '12.5% from 2021-01-02, 2029: 0 → 34',
          '12.5% from 2022-01-02, 2029: 12534 → 12500',
          '12.5% from 2022-01-02, 2030: 0 → 34',
          '12.5% from 2023-01-02, 2030: 12534 → 12500',
          '12.5% from 2023-01-02, 2031: 0 → 34',
          '12.5% from 2024-01-02, 2031: 12534 → 12500',
          '12.5% from 2024-01-02, 2032: 0 → 34',
          '20% from 2020-01-02, 2024: 20055 → 20000',
          '20% from 2020-01-02, 2025: 0 → 55',
          '20% from 2024-01-02, 2028: 20055 → 20000',
          '20% from 2024-01-02, 2029: 0 → 55',
          '33.33% from 2021-01-01, 2023: 33330 → 33340',
          '33.33% from 2021-01-01, 2024: 10 → 0',
      ]);
    });

    it('leaves every year before both end years unchanged', () => {
      for (const { rate, activation, oldEnd, newEnd } of cases) {
        const firstEndYear = Math.min(getTimelessDateYear(oldEnd), getTimelessDateYear(newEnd));
        for (let year = getTimelessDateYear(activation); year < firstEndYear; year++) {
          expect(calculateDepreciation(rate, 123_457, activation, year)).toEqual(
            calculateDepreciation(rate, 123_457, activation, year, oldEnd),
          );
        }
      }
    });
  });
});
