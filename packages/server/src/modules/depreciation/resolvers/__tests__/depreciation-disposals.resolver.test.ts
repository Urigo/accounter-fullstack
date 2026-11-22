import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import { degradeChargesAccountantApproval } from '../../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import { DepreciationCategoriesProvider } from '../../providers/depreciation-categories.provider.js';
import { DepreciationDisposalsProvider } from '../../providers/depreciation-disposals.provider.js';
import { DepreciationProvider } from '../../providers/depreciation.provider.js';
import { depreciationDisposalsResolvers } from '../depreciation-disposals.resolver.js';

vi.mock('../../../accountant-approval/helpers/degrade-charges.helper.js', () => ({
  degradeChargesAccountantApproval: vi.fn(),
}));

const OWNER_ID = 'bb000000-0000-4000-8000-000000000001';
const RECORD_ID = 'dd000000-0000-4000-8000-000000000001';
const NO_AMOUNT_RECORD_ID = 'dd000000-0000-4000-8000-000000000002';
const DISPOSED_RECORD_ID = 'dd000000-0000-4000-8000-000000000003';
const CHARGE_ID = 'cc000000-0000-4000-8000-000000000001';
const DISPOSAL_ID = 'ee000000-0000-4000-8000-000000000001';

type StoredDisposal = {
  id: string;
  depreciation_id: string;
  owner_id: string;
  charge_id: string | null;
  type: 'SALE' | 'COST_REFUND' | 'WRITE_OFF';
  disposal_date: TimelessDateString;
  disposed_cost: string;
  proceeds: string;
  description: string | null;
};

function storedSale(overrides: Partial<StoredDisposal> = {}): StoredDisposal {
  return {
    id: DISPOSAL_ID,
    depreciation_id: RECORD_ID,
    owner_id: OWNER_ID,
    charge_id: CHARGE_ID,
    type: 'SALE',
    disposal_date: '2025-07-01',
    disposed_cost: '4000',
    proceeds: '3000',
    description: 'sold the laptop',
    ...overrides,
  };
}

function record(id: string, amount: string | null) {
  return {
    id,
    owner_id: OWNER_ID,
    charge_id: 'cc000000-0000-4000-8000-0000000000ff',
    amount,
    currency: null,
    activation_date: '2024-01-01',
    expiration_date: '2034-01-01',
    category: 'category',
  };
}

function buildContext({
  disposals = [storedSale()],
  ledgerLock,
}: {
  disposals?: StoredDisposal[];
  ledgerLock?: TimelessDateString;
} = {}) {
  const records = [
    record(RECORD_ID, '12000'),
    record(NO_AMOUNT_RECORD_ID, null),
    record(DISPOSED_RECORD_ID, '5000'),
  ];
  const updateDisposal = vi.fn(async (params: { id: string }) => [{ ...storedSale(), ...params }]);
  const deleteDisposal = vi.fn(async ({ id }: { id: string }) =>
    disposals.filter(disposal => disposal.id === id),
  );

  const injector = {
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
        return {
          getChargeByIdLoader: {
            load: vi.fn(async (id: string) => ({ id, owner_id: OWNER_ID })),
          },
        };
      }
      if (token === DepreciationProvider) {
        return {
          getDepreciationRecordByIdLoader: {
            load: vi.fn(async (id: string) => records.find(r => r.id === id)),
          },
          getDepreciationRecordsActivatedBy: vi.fn(async () => records),
        };
      }
      if (token === DepreciationCategoriesProvider) {
        return {
          getDepreciationCategoriesByIdLoader: {
            load: vi.fn(async (id: string) => ({ id, percentage: '10' })),
          },
        };
      }
      if (token === DepreciationDisposalsProvider) {
        const byRecord = (id: string) => disposals.filter(d => d.depreciation_id === id);
        return {
          getDisposalByIdLoader: {
            load: vi.fn(async (id: string) => disposals.find(d => d.id === id)),
          },
          getDisposalsByDepreciationIdLoader: {
            load: vi.fn(async (id: string) => byRecord(id)),
            loadMany: vi.fn(async (ids: string[]) => ids.map(byRecord)),
          },
          updateDisposal,
          deleteDisposal,
        };
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;

  return { context: { injector }, updateDisposal, deleteDisposal };
}

type AnyResolver = (parent: unknown, args: unknown, context: unknown, info: unknown) => unknown;

function call(
  resolver: unknown,
  args: unknown,
  context: unknown,
): Promise<Record<string, unknown> | unknown> {
  const fn = (
    typeof resolver === 'function' ? resolver : (resolver as { resolve: AnyResolver }).resolve
  ) as AnyResolver;
  return Promise.resolve(fn({}, args, context, {}));
}

function updateDisposal(context: unknown, input: Record<string, unknown>) {
  return call(
    depreciationDisposalsResolvers.Mutation!.updateDepreciationDisposal,
    { input: { id: DISPOSAL_ID, ...input } },
    context,
  ) as Promise<Record<string, unknown>>;
}

describe('depreciation disposals resolvers', () => {
  beforeEach(() => {
    vi.mocked(degradeChargesAccountantApproval).mockReset().mockResolvedValue(new Map());
  });

  describe('Mutation.updateDepreciationDisposal', () => {
    it('turns a sale into a write-off without being sent proceeds', async () => {
      const { context, updateDisposal: update } = buildContext();

      const result = await updateDisposal(context, { type: 'WRITE_OFF', chargeId: null });

      expect(result).not.toHaveProperty('message');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'WRITE_OFF', proceeds: 0, clearChargeId: true }),
      );
    });

    it('turns a sale into a cost refund with proceeds equal to its cost', async () => {
      const { context, updateDisposal: update } = buildContext();

      const result = await updateDisposal(context, { type: 'COST_REFUND' });

      expect(result).not.toHaveProperty('message');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'COST_REFUND', proceeds: 4000 }),
      );
    });

    it('keeps the stored proceeds of a sale', async () => {
      const { context, updateDisposal: update } = buildContext();

      await updateDisposal(context, { disposedCost: 5000 });

      expect(update).toHaveBeenCalledWith(expect.objectContaining({ proceeds: 3000 }));
    });

    it('rejects editing a disposal dated in the locked period, even to move it out', async () => {
      const { context, updateDisposal: update } = buildContext({ ledgerLock: '2025-12-31' });

      const result = await updateDisposal(context, { disposalDate: '2026-02-01' });

      expect(result).toMatchObject({
        __typename: 'CommonError',
        message: expect.stringContaining('in the locked period (2025-12-31)'),
      });
      expect(update).not.toHaveBeenCalled();
    });

    it('clears the description when sent null', async () => {
      const { context, updateDisposal: update } = buildContext();

      await updateDisposal(context, { description: null });

      expect(update).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
    });

    it('keeps the stored description when it is left out', async () => {
      const { context, updateDisposal: update } = buildContext();

      await updateDisposal(context, { disposedCost: 5000 });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'sold the laptop' }),
      );
    });
  });

  describe('Mutation.deleteDepreciationDisposal', () => {
    it('deletes a disposal outside the locked period', async () => {
      const { context, deleteDisposal } = buildContext({ ledgerLock: '2025-06-30' });

      const result = await call(
        depreciationDisposalsResolvers.Mutation!.deleteDepreciationDisposal,
        { id: DISPOSAL_ID },
        context,
      );

      expect(result).toBe(true);
      expect(deleteDisposal).toHaveBeenCalledWith({ id: DISPOSAL_ID });
    });

    it('refuses to delete a disposal dated in the locked period', async () => {
      const { context, deleteDisposal } = buildContext({ ledgerLock: '2025-12-31' });

      await expect(
        call(
          depreciationDisposalsResolvers.Mutation!.deleteDepreciationDisposal,
          { id: DISPOSAL_ID },
          context,
        ),
      ).rejects.toThrow('in the locked period (2025-12-31)');
      expect(deleteDisposal).not.toHaveBeenCalled();
    });

    it('returns false for an unknown disposal', async () => {
      const { context, deleteDisposal } = buildContext({ disposals: [] });

      const result = await call(
        depreciationDisposalsResolvers.Mutation!.deleteDepreciationDisposal,
        { id: DISPOSAL_ID },
        context,
      );

      expect(result).toBe(false);
      expect(deleteDisposal).not.toHaveBeenCalled();
    });
  });

  describe('Query.depreciationRecords', () => {
    it('lists only assets with cost left to dispose of', async () => {
      const { context } = buildContext({
        disposals: [
          storedSale(),
          storedSale({
            id: 'ee000000-0000-4000-8000-000000000002',
            depreciation_id: DISPOSED_RECORD_ID,
            disposed_cost: '5000',
          }),
        ],
      });

      const records = (await call(
        depreciationDisposalsResolvers.Query!.depreciationRecords,
        { activeOn: '2025-12-31' },
        context,
      )) as { id: string }[];

      expect(records.map(r => r.id)).toEqual([RECORD_ID]);
    });
  });
});
