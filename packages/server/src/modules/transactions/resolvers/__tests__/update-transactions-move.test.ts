import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_UUID } from '../../../../shared/constants.js';
import { degradeChargesAccountantApproval } from '../../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { deleteCharges } from '../../../charges/helpers/delete-charges.helper.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import { DocumentsProvider } from '../../../documents/providers/documents.provider.js';
import { MiscExpensesProvider } from '../../../misc-expenses/providers/misc-expenses.provider.js';
import { TransactionsProvider } from '../../providers/transactions.provider.js';
import { transactionsResolvers } from '../transactions.resolver.js';

/**
 * Moving transactions onto an existing charge (`fields.chargeId` set to a real id).
 *
 * The `EMPTY_UUID` unlink path has always deleted a former charge it emptied. A move onto a real
 * charge used not to, so a bank row that sat alone in its own charge left that charge behind with
 * nothing in it. The resolvers now run the same cleanup after any move: a former charge left with
 * no transactions, documents or misc expenses is deleted and reported in `deletedChargeIds`, so a
 * client drops its row instead of refetching a charge that no longer exists.
 */

vi.mock('../../../charges/helpers/delete-charges.helper.js', () => ({
  deleteCharges: vi.fn(),
}));

vi.mock('../../../accountant-approval/helpers/degrade-charges.helper.js', () => ({
  degradeChargesAccountantApproval: vi.fn(),
}));

const OWNER_ID = 'bb000000-0000-4000-8000-000000000001';
const TARGET_CHARGE = 'cc000000-0000-4000-8000-000000000001';
const SOLE_CHARGE = 'cc000000-0000-4000-8000-000000000002';
const BUSY_CHARGE = 'cc000000-0000-4000-8000-000000000003';
const NEW_CHARGE = 'cc000000-0000-4000-8000-000000000009';
const T1 = 'ee000000-0000-4000-8000-000000000001';
const T2 = 'ee000000-0000-4000-8000-000000000002';

type Row = { id: string; charge_id: string | null };

/**
 * An injector whose loaders answer with the state *after* the move: the moved transactions sit on
 * the target, and whatever `remaining` says is still on the former charges.
 */
function buildContext(
  transactions: Row[],
  remaining: {
    transactions?: Record<string, unknown[]>;
    documents?: Record<string, unknown[]>;
    miscExpenses?: Record<string, unknown[]>;
  } = {},
) {
  const byId = new Map(transactions.map(t => [t.id, t]));
  const updateTransactions = vi
    .fn()
    .mockImplementation(async ({ transactionIds }: { transactionIds: string[] }) =>
      transactionIds.map(id => ({ id })),
    );
  const generateCharge = vi.fn().mockResolvedValue({ id: NEW_CHARGE, owner_id: OWNER_ID });
  const cleared: Record<string, string[]> = { transactions: [], documents: [], miscExpenses: [] };
  const loaderFor = (key: keyof typeof cleared, table: Record<string, unknown[]> | undefined) => ({
    load: vi.fn(async (chargeId: string) => table?.[chargeId] ?? []),
    clear: vi.fn((chargeId: string) => {
      cleared[key].push(chargeId);
    }),
  });

  const injector = {
    get: (token: unknown) => {
      if (token === TransactionsProvider) {
        return {
          transactionByIdLoader: {
            load: vi.fn(async (id: string) => byId.get(id)),
            loadMany: vi.fn(async (ids: readonly string[]) => ids.map(id => byId.get(id))),
          },
          transactionsByChargeIDLoader: loaderFor('transactions', remaining.transactions),
          updateTransactions,
        };
      }
      if (token === ChargesProvider) {
        return {
          getChargeByIdLoader: {
            load: vi.fn(async (id: string) => ({ id, owner_id: OWNER_ID })),
          },
          generateCharge,
        };
      }
      if (token === DocumentsProvider) {
        return { getDocumentsByChargeIdLoader: loaderFor('documents', remaining.documents) };
      }
      if (token === MiscExpensesProvider) {
        return { getExpensesByChargeIdLoader: loaderFor('miscExpenses', remaining.miscExpenses) };
      }
      if (token === AdminContextProvider) {
        return { getVerifiedAdminContext: vi.fn().mockResolvedValue({ ownerId: OWNER_ID }) };
      }
      throw new Error(`unexpected provider requested: ${String(token)}`);
    },
  } as unknown as Injector;

  return { context: { injector } as never, updateTransactions, generateCharge, cleared };
}

type AnyResolver = (
  parent: unknown,
  args: unknown,
  context: unknown,
  info: unknown,
) => Promise<unknown>;

function resolve(name: 'updateTransactions' | 'updateTransaction'): AnyResolver {
  const resolver = transactionsResolvers.Mutation![name]!;
  return (typeof resolver === 'function' ? resolver : resolver.resolve) as AnyResolver;
}

describe('Mutation.updateTransactions — moving onto an existing charge', () => {
  beforeEach(() => {
    vi.mocked(deleteCharges).mockReset().mockResolvedValue(undefined);
    vi.mocked(degradeChargesAccountantApproval).mockReset().mockResolvedValue(new Map());
  });

  it('deletes a former charge the move left empty and reports it', async () => {
    const { context, cleared } = buildContext([{ id: T1, charge_id: SOLE_CHARGE }]);

    const result = await resolve('updateTransactions')(
      {},
      { transactionIds: [T1], fields: { chargeId: TARGET_CHARGE } },
      context,
      {},
    );

    expect(deleteCharges).toHaveBeenCalledTimes(1);
    expect(deleteCharges).toHaveBeenCalledWith([SOLE_CHARGE], expect.anything());
    expect(result).toMatchObject({ transactions: [T1], deletedChargeIds: [SOLE_CHARGE] });
    // The per-request loaders are cleared before the post-move read.
    expect(cleared.transactions).toEqual([SOLE_CHARGE]);
    expect(cleared.documents).toEqual([SOLE_CHARGE]);
    expect(cleared.miscExpenses).toEqual([SOLE_CHARGE]);
  });

  it('keeps former charges that still hold a document or a misc expense', async () => {
    const { context } = buildContext(
      [
        { id: T1, charge_id: SOLE_CHARGE },
        { id: T2, charge_id: BUSY_CHARGE },
      ],
      { documents: { [BUSY_CHARGE]: [{ id: 'doc' }] } },
    );

    const result = await resolve('updateTransactions')(
      {},
      { transactionIds: [T1, T2], fields: { chargeId: TARGET_CHARGE } },
      context,
      {},
    );

    expect(deleteCharges).toHaveBeenCalledWith([SOLE_CHARGE], expect.anything());
    expect(result).toMatchObject({ deletedChargeIds: [SOLE_CHARGE] });
  });

  it('keeps a former charge that still holds a misc expense', async () => {
    const { context } = buildContext([{ id: T1, charge_id: SOLE_CHARGE }], {
      miscExpenses: { [SOLE_CHARGE]: [{ id: 'expense' }] },
    });

    const result = await resolve('updateTransactions')(
      {},
      { transactionIds: [T1], fields: { chargeId: TARGET_CHARGE } },
      context,
      {},
    );

    expect(deleteCharges).not.toHaveBeenCalled();
    expect(result).toMatchObject({ deletedChargeIds: [] });
  });

  it('never deletes the target charge, even when a row was already on it', async () => {
    const { context } = buildContext([
      { id: T1, charge_id: TARGET_CHARGE },
      { id: T2, charge_id: SOLE_CHARGE },
    ]);

    const result = await resolve('updateTransactions')(
      {},
      { transactionIds: [T1, T2], fields: { chargeId: TARGET_CHARGE } },
      context,
      {},
    );

    expect(deleteCharges).toHaveBeenCalledWith([SOLE_CHARGE], expect.anything());
    expect(result).toMatchObject({ deletedChargeIds: [SOLE_CHARGE] });
  });

  it('runs no cleanup when the update does not move the rows', async () => {
    const { context } = buildContext([{ id: T1, charge_id: SOLE_CHARGE }]);

    const result = await resolve('updateTransactions')(
      {},
      { transactionIds: [T1], fields: { isFee: true } },
      context,
      {},
    );

    expect(deleteCharges).not.toHaveBeenCalled();
    expect(result).toMatchObject({ deletedChargeIds: [] });
  });

  it('still reports the former charge the unlink path deletes', async () => {
    const { context, generateCharge } = buildContext([{ id: T1, charge_id: SOLE_CHARGE }], {
      // Before the unlink the sole transaction is still on its charge.
      transactions: { [SOLE_CHARGE]: [{ id: T1, charge_id: SOLE_CHARGE }] },
    });

    const result = await resolve('updateTransactions')(
      {},
      { transactionIds: [T1], fields: { chargeId: EMPTY_UUID } },
      context,
      {},
    );

    expect(generateCharge).toHaveBeenCalledTimes(1);
    expect(deleteCharges).toHaveBeenCalledTimes(1);
    expect(deleteCharges).toHaveBeenCalledWith([SOLE_CHARGE], expect.anything());
    expect(result).toMatchObject({ deletedChargeIds: [SOLE_CHARGE] });
  });
});

describe('Mutation.updateTransaction — moving onto an existing charge', () => {
  beforeEach(() => {
    vi.mocked(deleteCharges).mockReset().mockResolvedValue(undefined);
    vi.mocked(degradeChargesAccountantApproval).mockReset().mockResolvedValue(new Map());
  });

  it('deletes the former charge when the moved transaction was all it held', async () => {
    const { context } = buildContext([{ id: T1, charge_id: SOLE_CHARGE }]);

    const result = await resolve('updateTransaction')(
      {},
      { transactionId: T1, fields: { chargeId: TARGET_CHARGE } },
      context,
      {},
    );

    expect(result).toBe(T1);
    expect(deleteCharges).toHaveBeenCalledTimes(1);
    expect(deleteCharges).toHaveBeenCalledWith([SOLE_CHARGE], expect.anything());
  });

  it('keeps the former charge when another transaction remains on it', async () => {
    const { context } = buildContext([{ id: T1, charge_id: BUSY_CHARGE }], {
      transactions: { [BUSY_CHARGE]: [{ id: T2, charge_id: BUSY_CHARGE }] },
    });

    await resolve('updateTransaction')(
      {},
      { transactionId: T1, fields: { chargeId: TARGET_CHARGE } },
      context,
      {},
    );

    expect(deleteCharges).not.toHaveBeenCalled();
  });
});
