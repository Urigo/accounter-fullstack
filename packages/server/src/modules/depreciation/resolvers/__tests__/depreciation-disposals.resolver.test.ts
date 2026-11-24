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
const NEW_DISPOSAL_ID = 'ee000000-0000-4000-8000-0000000000aa';

type StoredDisposal = {
  id: string;
  depreciation_id: string;
  owner_id: string;
  charge_id: string | null;
  type: 'SALE' | 'COST_REFUND' | 'WRITE_OFF';
  refund_mode: 'FROM_ACTIVATION' | 'FROM_REFUND_DATE' | null;
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
    refund_mode: null,
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
  const insertDisposal = vi.fn(async () => [storedSale({ id: NEW_DISPOSAL_ID })]);
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
          insertDisposal,
          updateDisposal,
          deleteDisposal,
        };
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;

  return { context: { injector }, insertDisposal, updateDisposal, deleteDisposal };
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
        expect.objectContaining({
          type: 'WRITE_OFF',
          refundMode: null,
          proceeds: 0,
          clearChargeId: true,
        }),
      );
    });

    it('turns a sale into a cost refund with no proceeds and the default mode', async () => {
      const { context, updateDisposal: update } = buildContext();

      const result = await updateDisposal(context, { type: 'COST_REFUND' });

      expect(result).not.toHaveProperty('message');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'COST_REFUND',
          refundMode: 'FROM_ACTIVATION',
          proceeds: 0,
        }),
      );
    });

    it('rejects proceeds for a cost refund', async () => {
      const { context, updateDisposal: update } = buildContext();

      const result = await updateDisposal(context, { type: 'COST_REFUND', proceeds: 4000 });

      expect(result).toMatchObject({
        __typename: 'CommonError',
        message: expect.stringContaining('A cost refund has no proceeds'),
      });
      expect(update).not.toHaveBeenCalled();
    });

    it('rejects a refund mode for a sale', async () => {
      const { context, updateDisposal: update } = buildContext();

      const result = await updateDisposal(context, { refundMode: 'FROM_REFUND_DATE' });

      expect(result).toMatchObject({
        __typename: 'CommonError',
        message: expect.stringContaining('A refund mode applies only to a cost refund'),
      });
      expect(update).not.toHaveBeenCalled();
    });

    it('keeps the mode of a cost refund, and ignores the proceeds an older refund stored', async () => {
      const { context, updateDisposal: update } = buildContext({
        disposals: [
          storedSale({
            type: 'COST_REFUND',
            refund_mode: 'FROM_REFUND_DATE',
            disposed_cost: '1200',
            proceeds: '1200',
          }),
        ],
      });

      const result = await updateDisposal(context, { disposedCost: 1000 });

      expect(result).not.toHaveProperty('message');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ refundMode: 'FROM_REFUND_DATE', proceeds: 0 }),
      );
    });

    it('changes the mode of a cost refund', async () => {
      const { context, updateDisposal: update } = buildContext({
        disposals: [storedSale({ type: 'COST_REFUND', disposed_cost: '1200', proceeds: '0' })],
      });

      await updateDisposal(context, { refundMode: 'FROM_REFUND_DATE' });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ refundMode: 'FROM_REFUND_DATE' }),
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

  describe('Mutation.insertDepreciationDisposal', () => {
    const refundInput = {
      depreciationRecordId: RECORD_ID,
      chargeId: CHARGE_ID,
      type: 'COST_REFUND',
      disposalDate: '2025-07-01',
      disposedCost: 1200,
    };

    it('stores a cost refund with no proceeds and the default mode', async () => {
      const { context, insertDisposal } = buildContext({ disposals: [] });

      const result = await call(
        depreciationDisposalsResolvers.Mutation!.insertDepreciationDisposal,
        { input: refundInput },
        context,
      );

      expect(result).not.toHaveProperty('message');
      expect(insertDisposal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'COST_REFUND',
          refundMode: 'FROM_ACTIVATION',
          disposedCost: 1200,
          proceeds: 0,
        }),
      );
    });

    it('stores a sale with its proceeds and no mode', async () => {
      const { context, insertDisposal } = buildContext({ disposals: [] });

      await call(
        depreciationDisposalsResolvers.Mutation!.insertDepreciationDisposal,
        { input: { ...refundInput, type: 'SALE', disposedCost: 4000, proceeds: 3000 } },
        context,
      );

      expect(insertDisposal).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SALE', refundMode: null, proceeds: 3000 }),
      );
    });
  });

  describe('Query.previewDepreciationDisposal', () => {
    it('previews a cost refund: cost reduction, correction, new cost and book value', async () => {
      const { context } = buildContext({ disposals: [] });

      const result = await call(
        depreciationDisposalsResolvers.Query!.previewDepreciationDisposal,
        {
          input: {
            depreciationRecordId: RECORD_ID,
            chargeId: CHARGE_ID,
            type: 'COST_REFUND',
            disposalDate: '2025-07-01',
            disposedCost: 1200,
          },
        },
        context,
      );

      // 2024 booked 1,200 on 12,000 at 10%; 1,080 on the corrected cost
      expect(result).toMatchObject({
        __typename: 'DepreciationDisposalComputation',
        proceeds: { raw: 0 },
        gainLoss: { raw: 0 },
        costReduction: { raw: 1200 },
        depreciationCorrection: { raw: 120 },
        remainingCost: { raw: 10_800 },
        remainingBookValue: { raw: 8640 },
      });
    });

    it('previews a sale with no cost reduction or correction', async () => {
      const { context } = buildContext({ disposals: [] });

      const result = await call(
        depreciationDisposalsResolvers.Query!.previewDepreciationDisposal,
        {
          input: {
            depreciationRecordId: RECORD_ID,
            chargeId: CHARGE_ID,
            type: 'SALE',
            disposalDate: '2025-07-01',
            disposedCost: 4000,
            proceeds: 3000,
          },
        },
        context,
      );

      expect(result).toMatchObject({
        proceeds: { raw: 3000 },
        gainLoss: { raw: -401 },
        costReduction: { raw: 0 },
        depreciationCorrection: { raw: 0 },
        remainingCost: { raw: 8000 },
        remainingBookValue: { raw: 6400 },
      });
    });
  });

  describe('DepreciationDisposal', () => {
    function field(name: string, disposal: StoredDisposal, context: unknown) {
      const resolver = (depreciationDisposalsResolvers.DepreciationDisposal as Record<string, unknown>)[
        name
      ];
      const fn = (
        typeof resolver === 'function' ? resolver : (resolver as { resolve: AnyResolver }).resolve
      ) as AnyResolver;
      return Promise.resolve(fn(disposal, {}, context, {}));
    }

    it('reads a refund stored before refund modes existed as FROM_ACTIVATION with no proceeds', async () => {
      const storedRefund = storedSale({
        type: 'COST_REFUND',
        refund_mode: null,
        disposed_cost: '1200',
        proceeds: '1200',
      });
      const { context } = buildContext({ disposals: [storedRefund] });

      await expect(field('refundMode', storedRefund, context)).resolves.toBe('FROM_ACTIVATION');
      await expect(field('proceeds', storedRefund, context)).resolves.toMatchObject({ raw: 0 });
      await expect(field('gainLoss', storedRefund, context)).resolves.toMatchObject({ raw: 0 });
      await expect(field('costReduction', storedRefund, context)).resolves.toMatchObject({
        raw: 1200,
      });
      await expect(field('depreciationCorrection', storedRefund, context)).resolves.toMatchObject(
        { raw: 120 },
      );
    });

    it('gives a sale no mode, no cost reduction and no correction', async () => {
      const sale = storedSale();
      const { context } = buildContext({ disposals: [sale] });

      await expect(field('refundMode', sale, context)).resolves.toBeNull();
      await expect(field('proceeds', sale, context)).resolves.toMatchObject({ raw: 3000 });
      await expect(field('costReduction', sale, context)).resolves.toMatchObject({ raw: 0 });
      await expect(field('depreciationCorrection', sale, context)).resolves.toMatchObject({
        raw: 0,
      });
    });
  });
});
