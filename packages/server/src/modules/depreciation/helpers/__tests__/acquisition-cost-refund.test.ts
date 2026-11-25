import { describe, expect, it } from 'vitest';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import {
  calculateAssetYear,
  calculateDepreciation,
  computeCostRefund,
  computeDisposal,
  depreciationEndDate,
  validateAssetDisposals,
  validateDisposalKind,
  type AssetDepreciationInput,
  type AssetDisposalInput,
} from '../asset-depreciation.helper.js';

/*
 * The acquisition cost-refund case (spec §3), in whole shekels.
 *
 * Four intangible assets are activated on 2023-08-20. On 2024-04-14 the seller refunds part of the
 * price; each asset's part is a cost refund from activation (the default mode): the refund corrects
 * the original price. 2023 stays as filed; 2024 reverses the depreciation booked on the refunded
 * part (the recapture, ordinary income) and depreciates the corrected cost.
 */

const d = (date: string) => date as TimelessDateString;

const activationDate = d('2023-08-20');
const refundDate = d('2024-04-14');

type SpecAsset = {
  name: string;
  asset: AssetDepreciationInput;
  refund: AssetDisposalInput;
};

const software: SpecAsset = {
  name: 'software',
  asset: { cost: 592_000, depreciationRate: 33, activationDate },
  refund: {
    id: 'software-refund',
    kind: 'COST_REFUND',
    refundMode: 'FROM_ACTIVATION',
    disposalDate: refundDate,
    disposedCost: 59_200,
    proceeds: 0,
  },
};

const customerRelationships: SpecAsset = {
  name: 'customer relationships',
  asset: { cost: 740_000, depreciationRate: 12.5, activationDate },
  refund: {
    id: 'customer-relationships-refund',
    kind: 'COST_REFUND',
    // no mode: from activation is the default
    disposalDate: refundDate,
    disposedCost: 74_000,
    proceeds: 0,
  },
};

const goodwill: SpecAsset = {
  name: 'goodwill',
  asset: { cost: 222_000, depreciationRate: 10, activationDate },
  refund: {
    id: 'goodwill-refund',
    kind: 'COST_REFUND',
    refundMode: 'FROM_ACTIVATION',
    disposalDate: refundDate,
    disposedCost: 222_000,
    proceeds: 0,
  },
};

const trademarks: SpecAsset = {
  name: 'trademarks',
  asset: { cost: 148_000, depreciationRate: 0, activationDate },
  refund: {
    id: 'trademarks-refund',
    kind: 'COST_REFUND',
    refundMode: 'FROM_ACTIVATION',
    disposalDate: refundDate,
    disposedCost: 14_800,
    proceeds: 0,
  },
};

const depreciated = [software, customerRelationships, goodwill];
const all = [...depreciated, trademarks];

const year = (spec: SpecAsset, y: number) => calculateAssetYear(spec.asset, [spec.refund], y);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe('acquisition cost refund (spec §3)', () => {
  it('validates the refunds', () => {
    for (const spec of all) {
      expect(validateAssetDisposals(spec.asset, [spec.refund])).toEqual([]);
      expect(
        validateDisposalKind({
          type: 'COST_REFUND',
          proceeds: spec.refund.proceeds,
          refundMode: spec.refund.refundMode,
          chargeId: 'refund-charge',
        }),
      ).toEqual([]);
    }
  });

  it('ends depreciation on activation + N years − 1 day', () => {
    expect(depreciationEndDate(33, activationDate)).toBe('2026-08-30');
    expect(depreciationEndDate(12.5, activationDate)).toBe('2031-08-19');
    expect(depreciationEndDate(10, activationDate)).toBe('2033-08-19');
    expect(depreciationEndDate(0, activationDate)).toBeNull();
  });

  describe('2023', () => {
    it('stays as filed, unchanged by the refund', () => {
      expect(depreciated.map(spec => year(spec, 2023).yearDepreciation)).toEqual([
        71_721, 33_959, 8150,
      ]);
      expect(sum(depreciated.map(spec => year(spec, 2023).yearDepreciation))).toBe(113_830);
      for (const spec of all) {
        expect(year(spec, 2023)).toEqual(calculateAssetYear(spec.asset, [], 2023));
      }
      expect(year(trademarks, 2023)).toMatchObject({
        additions: 148_000,
        closingCost: 148_000,
        yearDepreciation: 0,
        closingAccumulatedDepreciation: 0,
        netBookValue: 148_000,
      });
    });

    it('recomputed on the corrected cost', () => {
      const recomputed = depreciated.map(
        spec =>
          calculateDepreciation(
            spec.asset.depreciationRate,
            spec.asset.cost - spec.refund.disposedCost,
            activationDate,
            2023,
          ).yearlyDepreciationAmount,
      );
      expect(recomputed).toEqual([64_549, 30_563, 0]);
      expect(sum(recomputed)).toBe(95_112);
    });
  });

  describe('2024, the refund year', () => {
    it('recaptures the depreciation booked in 2023 on the refunded part', () => {
      const recaptures = all.map(spec => year(spec, 2024).costRefunds[0]?.recapture);
      expect(recaptures).toEqual([7172, 3396, 8150, 0]);
      expect(sum(recaptures)).toBe(18_718);

      expect(all.map(spec => year(spec, 2024).depreciationCorrection)).toEqual([
        7172, 3396, 8150, 0,
      ]);
      expect(computeCostRefund(software.asset, [software.refund], software.refund.id)).toEqual({
        id: 'software-refund',
        refundDate: '2024-04-14',
        mode: 'FROM_ACTIVATION',
        costReduction: 59_200,
        recapture: 7172,
        excessIncome: 0,
      });
      expect(
        computeCostRefund(
          customerRelationships.asset,
          [customerRelationships.refund],
          customerRelationships.refund.id,
        )?.mode,
      ).toBe('FROM_ACTIVATION');
      // a refund is not a disposal: no proceeds, no gain or loss
      for (const spec of all) {
        expect(year(spec, 2024).disposals).toEqual([]);
        expect(year(spec, 2024).disposedCost).toBe(0);
        expect(computeDisposal(spec.asset, [spec.refund], spec.refund.id)).toBeNull();
      }
    });

    it('depreciates the corrected cost for the full year, with no goodwill depreciation', () => {
      const depreciation = all.map(spec => year(spec, 2024).yearDepreciation);
      expect(depreciation).toEqual([175_824, 83_250, 0, 0]);
      expect(sum(depreciation)).toBe(259_074);
      expect(year(software, 2024).yearlyDepreciationRate).toBe(33);
      expect(year(customerRelationships, 2024).yearlyDepreciationRate).toBe(12.5);
    });

    it('closes the year on the corrected cost', () => {
      expect(all.map(spec => year(spec, 2024).openingCost)).toEqual([
        592_000, 740_000, 222_000, 148_000,
      ]);
      expect(all.map(spec => year(spec, 2024).refundedCost)).toEqual([
        59_200, 74_000, 222_000, 14_800,
      ]);
      expect(all.map(spec => year(spec, 2024).closingCost)).toEqual([
        532_800, 666_000, 0, 133_200,
      ]);
      expect(all.map(spec => year(spec, 2024).openingAccumulatedDepreciation)).toEqual([
        71_721, 33_959, 8150, 0,
      ]);
      expect(all.map(spec => year(spec, 2024).closingAccumulatedDepreciation)).toEqual([
        240_373, 113_813, 0, 0,
      ]);
      expect(all.map(spec => year(spec, 2024).netBookValue)).toEqual([
        292_427, 552_187, 0, 133_200,
      ]);
      for (const spec of all) {
        const result = year(spec, 2024);
        expect(result.closingAccumulatedDepreciation).toBe(
          result.openingAccumulatedDepreciation +
            result.yearDepreciation -
            result.disposedAccumulatedDepreciation -
            result.depreciationCorrection,
        );
        expect(result.closingCost).toBe(
          result.openingCost + result.additions - result.disposedCost - result.refundedCost,
        );
      }
    });
  });

  describe('later years', () => {
    it('keep depreciating the corrected cost', () => {
      expect(all.map(spec => year(spec, 2025).yearDepreciation)).toEqual([175_824, 83_250, 0, 0]);
      // from the refund year on, the corrected asset follows its own schedule from activation
      for (const spec of depreciated) {
        const correctedCost = spec.asset.cost - spec.refund.disposedCost;
        for (let y = 2024; y <= 2035; y++) {
          const expected = calculateDepreciation(
            spec.asset.depreciationRate,
            correctedCost,
            activationDate,
            y,
          );
          const result = year(spec, y);
          expect(result.yearDepreciation).toBe(expected.yearlyDepreciationAmount);
          expect(result.closingAccumulatedDepreciation).toBe(
            expected.pastDepreciationAmount + expected.yearlyDepreciationAmount,
          );
        }
      }
    });

    it('end with the leftover in the end year', () => {
      expect(year(software, 2026).yearDepreciation).toBe(116_603);
      expect(year(software, 2026).netBookValue).toBe(0);
      expect(year(software, 2027).yearDepreciation).toBe(0);

      expect(year(customerRelationships, 2030).yearDepreciation).toBe(83_250);
      expect(year(customerRelationships, 2031).yearDepreciation).toBe(52_687);
      expect(year(customerRelationships, 2031).netBookValue).toBe(0);
      expect(year(customerRelationships, 2032).yearDepreciation).toBe(0);
    });

    it('leave goodwill closed and trademarks at cost, never depreciated', () => {
      for (const y of [2025, 2030, 2040]) {
        expect(year(goodwill, y)).toMatchObject({
          openingCost: 0,
          closingCost: 0,
          yearDepreciation: 0,
          closingAccumulatedDepreciation: 0,
          costRefunds: [],
        });
        expect(year(trademarks, y)).toMatchObject({
          openingCost: 133_200,
          closingCost: 133_200,
          yearDepreciation: 0,
          closingAccumulatedDepreciation: 0,
          netBookValue: 133_200,
        });
      }
    });
  });
});
