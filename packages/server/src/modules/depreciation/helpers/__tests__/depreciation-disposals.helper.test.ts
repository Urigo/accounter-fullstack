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
import {
  checkDisposal,
  resolveDisposalProceeds,
  toAssetInput,
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
  disposals = [],
}: {
  record?: Partial<IGetDepreciationRecordsByIdsResult>;
  disposals?: Partial<IGetDepreciationDisposalsByIdsResult>[];
} = {}): AssetContext {
  const record = {
    id: RECORD_ID,
    owner_id: OWNER_ID,
    charge_id: 'cc000000-0000-4000-8000-0000000000ff',
    amount: '12000',
    currency: null,
    activation_date: '2024-01-01',
    expiration_date: '2034-01-01',
    category: 'category',
    ...recordOverrides,
  } as IGetDepreciationRecordsByIdsResult;
  const category = { id: 'category', percentage: '10' } as IGetAllDepreciationCategoriesResult;
  return {
    record,
    category,
    asset: toAssetInput(record, category),
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

describe('resolveDisposalProceeds', () => {
  it('defaults a cost refund to its refunded cost', () => {
    expect(resolveDisposalProceeds({ ...sale, type: 'COST_REFUND', proceeds: null })).toBe(4000);
  });

  it('defaults a write-off to no proceeds', () => {
    expect(resolveDisposalProceeds({ ...sale, type: 'WRITE_OFF', proceeds: null })).toBe(0);
  });

  it('keeps the proceeds given', () => {
    expect(resolveDisposalProceeds(sale)).toBe(3000);
    expect(resolveDisposalProceeds({ ...sale, type: 'COST_REFUND', proceeds: 3500 })).toBe(3500);
  });
});

describe('checkDisposal', () => {
  it('computes a valid disposal', async () => {
    const check = await checkDisposal(buildInjector(), buildContext(), sale);

    expect(check.errors).toBeUndefined();
    expect(check.result).toMatchObject({ disposedCost: 4000, proceeds: 3000 });
    expect(check.remainingCost).toBe(8000);
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

  it('rejects an asset recorded in a foreign currency', async () => {
    const check = await checkDisposal(
      buildInjector(),
      buildContext({ record: { currency: 'USD' } as Partial<IGetDepreciationRecordsByIdsResult> }),
      sale,
    );

    expect(check.errors).toContain(
      'Disposals are only supported for assets recorded in ILS (this asset is in USD)',
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
