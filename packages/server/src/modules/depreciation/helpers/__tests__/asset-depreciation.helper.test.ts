import { describe, expect, it } from 'vitest';
import { addDaysToTimelessDate, getTimelessDateYear } from '../../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import {
  calculateAssetYear,
  calculateDepreciation,
  computeDisposal,
  naturalDepreciationEndDate,
  remainingAssetCost,
  validateAssetDisposals,
  validateDisposalKind,
  type AssetDepreciationInput,
  type AssetDisposalInput,
} from '../asset-depreciation.helper.js';

const d = (date: string) => date as TimelessDateString;

/** The expiration date the DB stores: activation + 100/rate × 365 days */
const sqlExpirationDate = (rate: number, activationDate: TimelessDateString) =>
  addDaysToTimelessDate(activationDate, Math.round((100 / rate) * 365));

describe('calculateAssetYear without disposals', () => {
  const rates = [6, 7, 15, 25, 33, 33.33];
  const activationDates = ['2019-01-01', '2020-02-29', '2021-07-01', '2022-12-31', '2024-03-15'];
  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2030, 2040];

  it('matches calculateDepreciation for every year, and is fully depreciated after the end year', () => {
    for (const rate of rates) {
      for (const activation of activationDates) {
        for (const expirationDate of [undefined, sqlExpirationDate(rate, d(activation))]) {
          const endYear = getTimelessDateYear(
            expirationDate ?? naturalDepreciationEndDate(rate, d(activation)),
          );
          for (const year of years) {
            const asset: AssetDepreciationInput = {
              cost: 123_457,
              depreciationRate: rate,
              activationDate: d(activation),
              expirationDate,
            };
            const expected = calculateDepreciation(
              rate,
              123_457,
              d(activation),
              year,
              expirationDate,
            );
            const result = calculateAssetYear(asset, [], year);
            expect(result.yearDepreciation).toBe(expected.yearlyDepreciationAmount);
            expect(result.openingAccumulatedDepreciation).toBe(expected.pastDepreciationAmount);
            expect(result.disposedCost).toBe(0);
            if (year > endYear) {
              // the accumulated depreciation carries over the end year's closing balance
              expect(result.openingAccumulatedDepreciation).toBe(123_457);
              expect(result.yearDepreciation).toBe(0);
              expect(result.netBookValue).toBe(0);
            }
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

    // the expiration date the DB stores: 2028-06-30
    expect(yearly(2028, d('2028-06-30'))).toEqual([
      [12_568, 0],
      [25_000, 12_568],
      [25_000, 37_568],
      [25_000, 62_568],
      [12_432, 87_568],
    ]);
    // the derived end date (2027-12-31)
    expect(yearly(2027)).toEqual([
      [12_568, 0],
      [25_000, 12_568],
      [25_000, 37_568],
      [37_432, 62_568],
    ]);
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

describe('calculateAssetYear at and after the end of depreciation', () => {
  // ₪100,000 at 25% from 2024-07-01, with the expiration date the DB stores (2028-06-30):
  // 12,568 in 2024, 25,000 in 2025–2027, the remaining 12,432 in 2028
  const asset: AssetDepreciationInput = {
    cost: 100_000,
    depreciationRate: 25,
    activationDate: d('2024-07-01'),
    expirationDate: d('2028-06-30'),
  };
  // The same asset with the end date derived from the rate (2027-12-31): 37,432 in 2027
  const derivedAsset: AssetDepreciationInput = { ...asset, expirationDate: undefined };

  const disposal = (
    disposalDate: string,
    disposedCost: number,
    proceeds: number,
  ): AssetDisposalInput => ({ id: 'd', disposalDate: d(disposalDate), disposedCost, proceeds });

  describe('a year after the end year', () => {
    it.each([
      ['the stored expiration date', asset, 2029],
      ['the derived end date', derivedAsset, 2028],
    ])('reports the asset fully depreciated (%s)', (_label, input, year) => {
      const result = calculateAssetYear(input, [], year);
      expect(result.openingAccumulatedDepreciation).toBe(100_000);
      expect(result.yearDepreciation).toBe(0);
      expect(result.closingAccumulatedDepreciation).toBe(100_000);
      expect(result.netBookValue).toBe(0);
    });

    it.each([
      ['the stored expiration date', asset, '2029-03-01'],
      ['the derived end date', derivedAsset, '2028-03-01'],
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
      ['on the stored expiration date', asset, '2028-06-30', 12_432, 2028],
      ['after the stored (mid-year) expiration date', asset, '2028-09-30', 12_432, 2028],
      ['on the derived end date', derivedAsset, '2027-12-31', 37_432, 2027],
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
      ['on the stored expiration date', asset, '2028-06-30', 12_432, 2028],
      ['after the stored (mid-year) expiration date', asset, '2028-09-30', 12_432, 2028],
      ['on the derived end date', derivedAsset, '2027-12-31', 37_432, 2027],
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
      // ₪100,000 at 10% from 2020-01-01; the DB stores 2029-12-29 as the expiration date.
      // 2020–2028 depreciate 90,000, so 2029 takes the remaining 10,000, although
      // Jan 1 – Dec 29 is only 363/365 of a year (9,945)
      const tenPercent: AssetDepreciationInput = {
        cost: 100_000,
        depreciationRate: 10,
        activationDate: d('2020-01-01'),
        expirationDate: sqlExpirationDate(10, d('2020-01-01')),
      };

      it('has the expected end date and end-year depreciation', () => {
        expect(tenPercent.expirationDate).toBe('2029-12-29');
        expect(calculateAssetYear(tenPercent, [], 2029).yearDepreciation).toBe(10_000);
      });

      it.each(['2029-12-29', '2029-12-30'])(
        'books no loss on a write-off on or after the end date (%s)',
        date => {
          const result = calculateAssetYear(tenPercent, [disposal(date, 100_000, 0)], 2029);
          expect(result.yearDepreciation).toBe(10_000);
          expect(result.disposals[0]).toMatchObject({
            accumulatedDepreciation: 100_000,
            netBookValue: 0,
            gainLoss: 0,
          });
        },
      );

      it('leaves nothing on the books after a partial sale on the end date', () => {
        const sale = disposal('2029-12-29', 40_000, 1000);
        const result = calculateAssetYear(tenPercent, [sale], 2029);
        expect(result.yearDepreciation).toBe(10_000);
        expect(result.disposals[0]).toMatchObject({ netBookValue: 0, gainLoss: 1000 });
        expect(result.netBookValue).toBe(0);
        expect(calculateAssetYear(tenPercent, [sale], 2032).netBookValue).toBe(0);
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
    ).toContain('Disposed cost must be positive');
  });

  it('reports whole-shekel amounts on a partial disposal', () => {
    const refund = {
      id: 'r',
      disposalDate: d('2025-07-01'),
      disposedCost: 33_333.33,
      proceeds: 33_333.33,
    };
    const result = computeDisposal(asset(100_000), [refund], 'r');
    expect(result).toMatchObject({ disposedCost: 33_333, proceeds: 33_333 });
    expect(Number.isInteger(result?.netBookValue)).toBe(true);
    expect(Number.isInteger(result?.gainLoss)).toBe(true);
    const year = calculateAssetYear(asset(100_000), [refund], 2025);
    expect(year.closingCost).toBe(66_667);
    expect(Number.isInteger(year.netBookValue)).toBe(true);
    expect(remainingAssetCost(asset(100_000), [refund])).toBe(66_667);
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
