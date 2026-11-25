import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import type {
  IGetAllDepreciationCategoriesResult,
  IGetDepreciationDisposalsByIdsResult,
  IGetDepreciationRecordsByIdsResult,
} from '../../types.js';
import { remainingAssetCost } from '../asset-depreciation.helper.js';
import { validateDepreciationPercentage } from '../depreciation-categories.helper.js';
import {
  checkDisposal,
  loadDisposalInputs,
  resolveDisposalProceeds,
  resolveRefundMode,
  toAssetInput,
  toDisposalInput,
  type AssetContext,
  type DisposalCandidate,
} from '../depreciation-disposals.helper.js';

const OWNER_ID = 'bb000000-0000-4000-8000-000000000001';
const OTHER_OWNER_ID = 'bb000000-0000-4000-8000-000000000002';
const RECORD_ID = 'dd000000-0000-4000-8000-000000000001';
const CHARGE_ID = 'cc000000-0000-4000-8000-000000000001';
const FOREIGN_CHARGE_ID = 'cc000000-0000-4000-8000-000000000002';
const MISSING_CHARGE_ID = 'cc000000-0000-4000-8000-000000000003';
const DISPOSAL_ID = 'ee000000-0000-4000-8000-000000000001';

function buildInjector({ ledgerLock }: { ledgerLock?: TimelessDateString } = {}) {
  const charges: Record<string, { id: string; owner_id: string }> = {
    [CHARGE_ID]: { id: CHARGE_ID, owner_id: OWNER_ID },
    [FOREIGN_CHARGE_ID]: { id: FOREIGN_CHARGE_ID, owner_id: OTHER_OWNER_ID },
  };
  return {
    get: (token: unknown) => {
      if (token === AdminContextProvider) {
        return {
          getVerifiedAdminContext: vi.fn(async () => ({
            ownerId: OWNER_ID,
            defaultLocalCurrency: 'ILS',
            ledgerLock,
          })),
        };
      }
      if (token === ChargesProvider) {
        return { getChargeByIdLoader: { load: vi.fn(async (id: string) => charges[id]) } };
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;
}

function buildContext({
  record: recordOverrides = {},
  localCost,
  disposals = [],
  percentage,
}: {
  record?: Partial<IGetDepreciationRecordsByIdsResult>;
  /** the resolved local cost; defaults to the record's amount */
  localCost?: number | null;
  disposals?: Partial<IGetDepreciationDisposalsByIdsResult>[];
  percentage?: string;
} = {}): AssetContext {
  const record = {
    id: RECORD_ID,
    owner_id: OWNER_ID,
    charge_id: 'cc000000-0000-4000-8000-0000000000ff',
    amount: '12000',
    currency: null,
    activation_date: '2024-01-01',
    category: 'category',
    ...recordOverrides,
  } as IGetDepreciationRecordsByIdsResult;
  const category = {
    id: 'category',
    percentage: percentage ?? '10',
  } as IGetAllDepreciationCategoriesResult;
  const defaultCost = record.amount == null ? null : Number(record.amount);
  const cost = localCost === undefined ? defaultCost : localCost;
  return {
    record,
    category,
    localCost: cost,
    asset: toAssetInput(record, category, cost),
    disposals: disposals.map(
      disposal =>
        ({
          depreciation_id: RECORD_ID,
          owner_id: OWNER_ID,
          charge_id: CHARGE_ID,
          type: 'SALE',
          description: null,
          ...disposal,
        }) as IGetDepreciationDisposalsByIdsResult,
    ),
  };
}

const sale: DisposalCandidate = {
  type: 'SALE',
  chargeId: CHARGE_ID,
  disposalDate: '2025-07-01',
  disposedCost: 4000,
  proceeds: 3000,
};

// a supplier refund of 10% of the asset's cost, in the asset's second year
const refund: DisposalCandidate = {
  type: 'COST_REFUND',
  chargeId: CHARGE_ID,
  disposalDate: '2025-07-01',
  disposedCost: 1200,
};

describe('resolveDisposalProceeds', () => {
  it('defaults to no proceeds', () => {
    expect(resolveDisposalProceeds({ proceeds: null })).toBe(0);
    expect(resolveDisposalProceeds({})).toBe(0);
  });

  it('keeps the proceeds given, so that validation can reject them where none are allowed', () => {
    expect(resolveDisposalProceeds(sale)).toBe(3000);
    expect(resolveDisposalProceeds({ proceeds: 3500 })).toBe(3500);
  });
});

describe('resolveRefundMode', () => {
  it('defaults a cost refund to FROM_ACTIVATION', () => {
    expect(resolveRefundMode(refund)).toBe('FROM_ACTIVATION');
    expect(resolveRefundMode({ ...refund, refundMode: null })).toBe('FROM_ACTIVATION');
  });

  it('keeps the mode given for a cost refund', () => {
    expect(resolveRefundMode({ ...refund, refundMode: 'FROM_REFUND_DATE' })).toBe(
      'FROM_REFUND_DATE',
    );
  });

  it('stores no mode for a sale or write-off', () => {
    expect(resolveRefundMode(sale)).toBeNull();
    expect(resolveRefundMode({ type: 'WRITE_OFF', refundMode: 'FROM_REFUND_DATE' })).toBeNull();
  });
});

describe('toDisposalInput', () => {
  it('passes a refund stored before refund modes existed with no proceeds and the default mode', () => {
    expect(
      toDisposalInput({
        id: DISPOSAL_ID,
        type: 'COST_REFUND',
        refund_mode: null,
        disposal_date: '2025-07-01',
        disposed_cost: '1200',
        proceeds: '1200',
      }),
    ).toEqual({
      id: DISPOSAL_ID,
      kind: 'COST_REFUND',
      refundMode: 'FROM_ACTIVATION',
      disposalDate: '2025-07-01',
      disposedCost: 1200,
      proceeds: 0,
    });
  });

  it('passes a sale with its proceeds and no mode', () => {
    expect(
      toDisposalInput({
        id: DISPOSAL_ID,
        type: 'SALE',
        refund_mode: null,
        disposal_date: '2025-07-01',
        disposed_cost: '4000',
        proceeds: '3000',
      }),
    ).toMatchObject({ kind: 'SALE', refundMode: null, proceeds: 3000 });
  });
});

describe('validateDepreciationPercentage', () => {
  it('accepts 0 (not depreciated) to 100', () => {
    expect(validateDepreciationPercentage(0)).toBeNull();
    expect(validateDepreciationPercentage(12.5)).toBeNull();
    expect(validateDepreciationPercentage(100)).toBeNull();
    expect(validateDepreciationPercentage(null)).toBeNull();
  });

  it('rejects a negative rate or one above 100', () => {
    expect(validateDepreciationPercentage(-1)).toMatch(/between 0 and 100/);
    expect(validateDepreciationPercentage(100.5)).toMatch(/between 0 and 100/);
    expect(validateDepreciationPercentage(Number.NaN)).toMatch(/between 0 and 100/);
  });
});

describe('checkDisposal', () => {
  it('computes a valid disposal', async () => {
    const check = await checkDisposal(buildInjector(), buildContext(), sale);

    // 2025 opens at 1,200 accumulated; to 2025-07-01 (182 days) adds 598, so the slice takes
    // round(1,798 × 4,000 / 12,000) = 599; the rest depreciates 401 to the year end
    expect(check.errors).toBeUndefined();
    expect(check.refundMode).toBeNull();
    expect(check.result).toEqual({
      disposedCost: 4000,
      proceeds: 3000,
      accumulatedDepreciation: 599,
      netBookValue: 3401,
      gainLoss: -401,
      costReduction: 0,
      depreciationCorrection: 0,
    });
    expect(check.remainingCost).toBe(8000);
    expect(check.remainingBookValue).toBe(6400);
  });

  describe('a cost refund', () => {
    it('defaults to FROM_ACTIVATION: the cost is corrected and the earlier depreciation recaptured', async () => {
      const check = await checkDisposal(buildInjector(), buildContext(), refund);

      // 2024 booked 1,200; on the corrected cost of 10,800 it would have been 1,080
      expect(check.errors).toBeUndefined();
      expect(check.refundMode).toBe('FROM_ACTIVATION');
      expect(check.result).toEqual({
        disposedCost: 1200,
        proceeds: 0,
        accumulatedDepreciation: 120,
        netBookValue: 1080,
        gainLoss: 0,
        costReduction: 1200,
        depreciationCorrection: 120,
      });
      // closing accumulated 1,200 − 120 + 1,080 (2025 on the corrected cost)
      expect(check.remainingCost).toBe(10_800);
      expect(check.remainingBookValue).toBe(8640);
    });

    it('FROM_REFUND_DATE lowers the cost and keeps the accumulated depreciation', async () => {
      const check = await checkDisposal(buildInjector(), buildContext(), {
        ...refund,
        refundMode: 'FROM_REFUND_DATE',
      });

      // 1,200 + 598 to the refund date, then round(1,080 × 183 / 365) = 541 on the reduced cost
      expect(check.errors).toBeUndefined();
      expect(check.refundMode).toBe('FROM_REFUND_DATE');
      expect(check.result).toMatchObject({
        costReduction: 1200,
        depreciationCorrection: 0,
        gainLoss: 0,
        proceeds: 0,
      });
      expect(check.remainingCost).toBe(10_800);
      expect(check.remainingBookValue).toBe(10_800 - 2339);
    });

    it('FROM_REFUND_DATE books the excess over book value as the correction', async () => {
      const check = await checkDisposal(buildInjector(), buildContext(), {
        ...refund,
        refundMode: 'FROM_REFUND_DATE',
        disposedCost: 11_000,
      });

      // 1,798 accumulated on the refund date, capped at the new cost of 1,000
      expect(check.errors).toBeUndefined();
      expect(check.result).toMatchObject({ costReduction: 11_000, depreciationCorrection: 798 });
      expect(check.remainingCost).toBe(1000);
      expect(check.remainingBookValue).toBe(0);
    });

    it('rejects proceeds', async () => {
      const check = await checkDisposal(buildInjector(), buildContext(), {
        ...refund,
        proceeds: 1200,
      });

      expect(check.errors).toContain(
        'A cost refund has no proceeds: the refunded amount reduces the cost',
      );
    });

    it('applies to an asset in a category that is not depreciated, with no correction', async () => {
      const check = await checkDisposal(buildInjector(), buildContext({ percentage: '0' }), refund);

      expect(check.errors).toBeUndefined();
      expect(check.result).toMatchObject({ costReduction: 1200, depreciationCorrection: 0 });
      expect(check.remainingCost).toBe(10_800);
      expect(check.remainingBookValue).toBe(10_800);
    });

    it('is counted before a later sale when it was stored before refund modes existed', async () => {
      // the stored refund has no mode and holds its cost as proceeds
      const check = await checkDisposal(
        buildInjector(),
        buildContext({
          disposals: [
            {
              id: DISPOSAL_ID,
              type: 'COST_REFUND',
              refund_mode: null,
              disposal_date: '2025-03-01',
              disposed_cost: '1200',
              proceeds: '1200',
            },
          ],
        }),
        sale,
      );

      expect(check.errors).toBeUndefined();
      expect(check.remainingCost).toBe(10_800 - 4000);
    });
  });

  it('rejects a refund mode on a sale or write-off', async () => {
    const onSale = await checkDisposal(buildInjector(), buildContext(), {
      ...sale,
      refundMode: 'FROM_ACTIVATION',
    });
    const onWriteOff = await checkDisposal(buildInjector(), buildContext(), {
      ...sale,
      type: 'WRITE_OFF',
      proceeds: null,
      refundMode: 'FROM_REFUND_DATE',
    });

    expect(onSale.errors).toContain('A refund mode applies only to a cost refund');
    expect(onWriteOff.errors).toContain('A refund mode applies only to a cost refund');
  });

  it('rejects a record without an amount', async () => {
    const check = await checkDisposal(
      buildInjector(),
      buildContext({ record: { amount: null } }),
      sale,
    );

    expect(check.errors).toContain(
      'Set an amount on the depreciation record before disposing of it',
    );
  });

  it('disposes of an asset paid in a foreign currency at its local cost', async () => {
    // $3,000 at ₪4 is a ₪12,000 cost; the disposal's amounts are in shekels
    const check = await checkDisposal(
      buildInjector(),
      buildContext({
        record: { amount: '3000', currency: 'USD' } as Partial<IGetDepreciationRecordsByIdsResult>,
        localCost: 12_000,
      }),
      sale,
    );

    expect(check.errors).toBeUndefined();
    expect(check.result).toMatchObject({ disposedCost: 4000, proceeds: 3000 });
    expect(check.remainingCost).toBe(8000);
  });

  it('rejects disposing of more than the local cost of a foreign-currency asset', async () => {
    const check = await checkDisposal(
      buildInjector(),
      buildContext({
        record: { amount: '3000', currency: 'USD' } as Partial<IGetDepreciationRecordsByIdsResult>,
        localCost: 12_000,
      }),
      { ...sale, disposedCost: 13_000 },
    );

    // the check is against the ₪12,000 local cost, not the 3,000 in dollars
    expect(check.errors).toContain(
      "Disposed cost (13000) exceeds the asset's cost (12000), both rounded to whole shekels",
    );
  });

  describe("refunds of a foreign-currency asset's whole cost in pieces", () => {
    // USD 10,000 with a ₪35,555 local cost: ₪3.5555 a dollar, so USD 5,000 is ₪17,777.50
    const asset = {
      record: {
        amount: '10000',
        currency: 'USD',
        local_amount: '35555',
      } as Partial<IGetDepreciationRecordsByIdsResult>,
      localCost: 35_555,
    };
    const usdRefund = (id: string, date: TimelessDateString, amount: string) => ({
      id,
      type: 'COST_REFUND' as const,
      refund_mode: null,
      disposal_date: date,
      disposed_cost: null,
      original_amount: amount,
      original_currency: 'USD' as const,
      proceeds: '0',
    });
    const SECOND_ID = 'ee000000-0000-4000-8000-000000000002';
    const THIRD_ID = 'ee000000-0000-4000-8000-000000000003';

    it('allocates two halves to exactly the cost, and accepts both', async () => {
      // the first half is stored; the second is checked against it
      const check = await checkDisposal(
        buildInjector(),
        buildContext({ ...asset, disposals: [usdRefund(DISPOSAL_ID, '2025-03-01', '5000')] }),
        { ...refund, disposedCost: undefined, originalAmount: 5000 },
      );

      expect(check.errors).toBeUndefined();
      expect(check.result?.costReduction).toBe(17_777);
      expect(check.remainingCost).toBe(0);

      // both stored: 17,778 + 17,777 = 35,555, so nothing is left for the disposal picker to offer
      const both = buildContext({
        ...asset,
        disposals: [
          usdRefund(DISPOSAL_ID, '2025-03-01', '5000'),
          usdRefund(SECOND_ID, '2025-07-01', '5000'),
        ],
      });
      const events = await loadDisposalInputs(buildInjector(), both.record, both.disposals);
      expect(events.map(event => event.disposedCost)).toEqual([17_778, 17_777]);
      expect(remainingAssetCost({ cost: 35_555 }, events)).toBe(0);
    });

    it('allocates a preview after a stored refund of the same date, as once it is stored', async () => {
      // the stored refund's id sorts after the new one's: creation time decides, not the id
      const storedId = 'ff000000-0000-4000-8000-000000000001';
      const newId = 'aa000000-0000-4000-8000-000000000001';
      const stored = {
        ...usdRefund(storedId, '2025-07-01', '5000'),
        created_at: new Date('2025-07-01T10:00:00.000Z'),
      };

      const check = await checkDisposal(
        buildInjector(),
        buildContext({ ...asset, disposals: [stored] }),
        { ...refund, disposalDate: '2025-07-01', disposedCost: undefined, originalAmount: 5000 },
      );

      // the preview comes last: the stored refund keeps 17,778, the new one takes 17,777
      expect(check.errors).toBeUndefined();
      expect(check.result?.costReduction).toBe(17_777);

      const both = buildContext({
        ...asset,
        disposals: [
          stored,
          {
            ...usdRefund(newId, '2025-07-01', '5000'),
            created_at: new Date('2025-07-01T11:00:00.000Z'),
          },
        ],
      });
      const events = await loadDisposalInputs(buildInjector(), both.record, both.disposals);
      expect(Object.fromEntries(events.map(event => [event.id, event.disposedCost]))).toEqual({
        [storedId]: 17_778,
        [newId]: 17_777,
      });
    });

    it('allocates an uneven three-way split in date order, whatever order it is given in', async () => {
      const context = buildContext({
        ...asset,
        disposals: [
          usdRefund(THIRD_ID, '2025-04-01', '3333.34'),
          usdRefund(SECOND_ID, '2025-03-01', '3333.33'),
          usdRefund(DISPOSAL_ID, '2025-02-01', '3333.33'),
        ],
      });

      const events = await loadDisposalInputs(buildInjector(), context.record, context.disposals);

      // round(3,333.33 × 3.5555) = 11,852; round(6,666.66 × 3.5555) = 23,703; then the rest
      expect(Object.fromEntries(events.map(event => [event.id, event.disposedCost]))).toEqual({
        [DISPOSAL_ID]: 11_852,
        [SECOND_ID]: 11_851,
        [THIRD_ID]: 11_852,
      });
      expect(remainingAssetCost({ cost: 35_555 }, events)).toBe(0);
    });
  });

  describe('an asset recorded in a foreign currency', () => {
    // USD 3,000 with a ₪12,000 local cost: ₪4 a dollar
    const usdAsset = {
      record: {
        amount: '3000',
        currency: 'USD',
        local_amount: '12000',
      } as Partial<IGetDepreciationRecordsByIdsResult>,
      localCost: 12_000,
    };

    it("takes a cost refund in the asset's currency, converted at its cost-basis rate", async () => {
      const check = await checkDisposal(buildInjector(), buildContext(usdAsset), {
        ...refund,
        disposedCost: undefined,
        originalAmount: 300,
      });

      // USD 300 at ₪4 is the same ₪1,200 refund
      expect(check.errors).toBeUndefined();
      expect(check.result).toMatchObject({ costReduction: 1200, depreciationCorrection: 120 });
      expect(check.exchangeRate).toBe(4);
      expect(check.stored).toEqual({
        disposedCost: null,
        originalAmount: 300,
        originalCurrency: 'USD',
      });
      expect(check.remainingCost).toBe(10_800);
    });

    it('counts a stored refund entered in its currency at its local cost', async () => {
      const check = await checkDisposal(
        buildInjector(),
        buildContext({
          ...usdAsset,
          disposals: [
            {
              id: DISPOSAL_ID,
              type: 'COST_REFUND',
              refund_mode: null,
              disposal_date: '2025-03-01',
              disposed_cost: null,
              original_amount: '300',
              original_currency: 'USD',
              proceeds: '0',
            },
          ],
        }),
        sale,
      );

      // 12,000 − 1,200 refunded − 4,000 sold
      expect(check.errors).toBeUndefined();
      expect(check.remainingCost).toBe(6800);
      expect(check.stored).toEqual({
        disposedCost: 4000,
        originalAmount: null,
        originalCurrency: null,
      });
    });

    it("rejects a cost refund given in the local currency instead of the asset's", async () => {
      const check = await checkDisposal(buildInjector(), buildContext(usdAsset), refund);

      expect(check.errors).toContain(
        'Enter a cost refund of an asset recorded in USD in USD (originalAmount)',
      );
    });

    it("rejects an amount in the asset's currency for a sale", async () => {
      const check = await checkDisposal(buildInjector(), buildContext(usdAsset), {
        ...sale,
        originalAmount: 1000,
      });

      expect(check.errors).toContain(
        "An amount in the asset's currency (originalAmount) is for cost refunds only",
      );
    });
  });

  it("rejects an amount in the asset's currency for an asset recorded in the local currency", async () => {
    const check = await checkDisposal(buildInjector(), buildContext(), {
      ...refund,
      disposedCost: undefined,
      originalAmount: 300,
    });

    expect(check.errors).toContain(
      "An amount in the asset's currency (originalAmount) is for assets recorded in a foreign currency; give this refund in ILS (disposedCost)",
    );
  });

  it('rejects a disposal dated in the locked period', async () => {
    const check = await checkDisposal(
      buildInjector({ ledgerLock: '2025-12-31' }),
      buildContext(),
      sale,
    );

    expect(check.errors).toContain(
      'Disposal date 2025-07-01 is in the locked period (2025-12-31)',
    );
  });

  it('accepts a disposal dated after the locked period', async () => {
    const check = await checkDisposal(
      buildInjector({ ledgerLock: '2025-06-30' }),
      buildContext(),
      sale,
    );

    expect(check.errors).toBeUndefined();
  });

  it('rejects an asset of another business', async () => {
    const check = await checkDisposal(
      buildInjector(),
      buildContext({ record: { owner_id: OTHER_OWNER_ID } }),
      sale,
    );

    expect(check.errors).toContain('The depreciation record belongs to a different business');
  });

  it('rejects a charge of another business', async () => {
    const check = await checkDisposal(buildInjector(), buildContext(), {
      ...sale,
      chargeId: FOREIGN_CHARGE_ID,
    });

    expect(check.errors).toContain(
      `Charge with id ${FOREIGN_CHARGE_ID} belongs to a different business`,
    );
  });

  it('rejects a charge that does not exist', async () => {
    const check = await checkDisposal(buildInjector(), buildContext(), {
      ...sale,
      chargeId: MISSING_CHARGE_ID,
    });

    expect(check.errors).toContain(`Charge with id ${MISSING_CHARGE_ID} not found`);
  });

  it('accepts a write-off without a charge', async () => {
    const check = await checkDisposal(buildInjector(), buildContext(), {
      ...sale,
      type: 'WRITE_OFF',
      chargeId: null,
      proceeds: null,
    });

    expect(check.errors).toBeUndefined();
    expect(check.result?.proceeds).toBe(0);
  });

  describe('editing a stored disposal', () => {
    const stored = {
      id: DISPOSAL_ID,
      disposal_date: '2025-03-01' as TimelessDateString,
      disposed_cost: '12000',
      proceeds: '5000',
    };

    it('replaces the stored disposal instead of adding to it', async () => {
      // as a new disposal the full cost is disposed twice; as an edit it replaces the stored one
      const context = buildContext({ disposals: [stored] });
      const candidate = { ...sale, disposedCost: 10_000 };

      const asNew = await checkDisposal(buildInjector(), context, candidate);
      const asEdit = await checkDisposal(buildInjector(), context, {
        ...candidate,
        id: DISPOSAL_ID,
      });

      expect(asNew.errors).toContain('The asset was fully disposed of before 2025-07-01');
      expect(asEdit.errors).toBeUndefined();
      expect(asEdit.remainingCost).toBe(2000);
    });

    it('rejects moving a disposal out of the locked period', async () => {
      const check = await checkDisposal(
        buildInjector({ ledgerLock: '2025-12-31' }),
        buildContext({ disposals: [stored] }),
        { ...sale, id: DISPOSAL_ID, disposalDate: '2026-02-01' },
      );

      expect(check.errors).toContain(
        "The disposal is dated 2025-03-01, in the locked period (2025-12-31), and can't be changed",
      );
    });
  });
});
