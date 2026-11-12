import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_UUID } from '../../../../shared/constants.js';
import { degradeChargesAccountantApproval } from '../../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { deleteChargesIfEmpty } from '../../../charges/helpers/delete-empty-charges.helper.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import { TransactionsProvider } from '../../providers/transactions.provider.js';
import { transactionsResolvers } from '../transactions.resolver.js';

/**
 * `updateTransaction` / `updateTransactions` moving transactions off their charge.
 *
 * The former charge may be left empty, so after the update it is handed to
 * `deleteChargesIfEmpty` — for an unlink (`EMPTY_UUID`) as well as a move to another existing
 * charge — never touching the charge the transactions moved into, and skipped entirely when the
 * update doesn't change the charge (e.g. a counterparty-only update). `updateTransactions` reports
 * the deleted charges back as `deletedChargeIds`. Unlinking several transactions
 * of the same charge used to keep that charge (the old inline check expected exactly one
 * transaction on it per moved transaction), leaving a ghost charge behind.
 */

vi.mock('../../../charges/helpers/delete-empty-charges.helper.js', () => ({
  deleteChargesIfEmpty: vi.fn(),
}));

vi.mock('../../../accountant-approval/helpers/degrade-charges.helper.js', () => ({
  degradeChargesAccountantApproval: vi.fn(),
}));

const TX_1 = 'aa000000-0000-4000-8000-000000000001';
const TX_2 = 'aa000000-0000-4000-8000-000000000002';
const FORMER_CHARGE_ID = 'cc000000-0000-4000-8000-000000000001';
const NEW_CHARGE_ID = 'cc000000-0000-4000-8000-000000000002';
const OTHER_CHARGE_ID = 'cc000000-0000-4000-8000-000000000003';
const OWNER_ID = 'bb000000-0000-4000-8000-000000000001';

function buildContext({ formerChargeId = FORMER_CHARGE_ID }: { formerChargeId?: string | null } = {}) {
  const transactions = new Map(
    [TX_1, TX_2].map(id => [id, { id, charge_id: formerChargeId }] as const),
  );
  const updateTransactions = vi.fn(async ({ transactionIds }: { transactionIds: string[] }) =>
    transactionIds.map(id => ({ id })),
  );
  const generateCharge = vi.fn().mockResolvedValue({ id: NEW_CHARGE_ID, owner_id: OWNER_ID });

  const injector = {
    get: (token: unknown) => {
      if (token === TransactionsProvider) {
        return {
          transactionByIdLoader: {
            load: vi.fn(async (id: string) => transactions.get(id)),
            loadMany: vi.fn(async (ids: string[]) => ids.map(id => transactions.get(id))),
          },
          updateTransactions,
        };
      }
      if (token === ChargesProvider) {
        return {
          getChargeByIdLoader: { load: vi.fn(async (id: string) => ({ id, owner_id: OWNER_ID })) },
          generateCharge,
        };
      }
      if (token === AdminContextProvider) {
        return { getVerifiedAdminContext: vi.fn().mockResolvedValue({ ownerId: OWNER_ID }) };
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;

  return { context: { injector } as never, generateCharge, updateTransactions };
}

type AnyResolver = (parent: unknown, args: unknown, context: unknown, info: unknown) => unknown;

function run(name: 'updateTransaction' | 'updateTransactions', args: unknown, context: unknown) {
  const resolver = transactionsResolvers.Mutation![name]!;
  const resolve = (typeof resolver === 'function' ? resolver : resolver.resolve) as AnyResolver;
  return resolve({}, args, context, {});
}

describe('transactions mutations — cleaning up the emptied former charge', () => {
  beforeEach(() => {
    vi.mocked(deleteChargesIfEmpty).mockReset().mockResolvedValue([]);
    vi.mocked(degradeChargesAccountantApproval).mockReset().mockResolvedValue(new Map());
  });

  it('updateTransaction: checks the former charge when moving to an existing charge', async () => {
    const { context, generateCharge } = buildContext();

    await run(
      'updateTransaction',
      { transactionId: TX_1, fields: { chargeId: OTHER_CHARGE_ID } },
      context,
    );

    expect(generateCharge).not.toHaveBeenCalled();
    expect(deleteChargesIfEmpty).toHaveBeenCalledTimes(1);
    expect(deleteChargesIfEmpty).toHaveBeenCalledWith([FORMER_CHARGE_ID], expect.anything(), {
      keepChargeIds: [OTHER_CHARGE_ID],
    });
  });

  it('updateTransaction: checks the former charge after unlinking', async () => {
    const { context, generateCharge } = buildContext();

    await run('updateTransaction', { transactionId: TX_1, fields: { chargeId: EMPTY_UUID } }, context);

    expect(generateCharge).toHaveBeenCalledTimes(1);
    expect(deleteChargesIfEmpty).toHaveBeenCalledTimes(1);
    expect(deleteChargesIfEmpty).toHaveBeenCalledWith([FORMER_CHARGE_ID], expect.anything(), {
      keepChargeIds: [NEW_CHARGE_ID],
    });
  });

  it('updateTransactions: checks the shared former charge after unlinking all its transactions', async () => {
    const { context, generateCharge } = buildContext();
    vi.mocked(deleteChargesIfEmpty).mockResolvedValue([FORMER_CHARGE_ID]);

    const result = await run(
      'updateTransactions',
      { transactionIds: [TX_1, TX_2], fields: { chargeId: EMPTY_UUID } },
      context,
    );

    expect(generateCharge).toHaveBeenCalledTimes(1);
    expect(deleteChargesIfEmpty).toHaveBeenCalledTimes(1);
    expect(deleteChargesIfEmpty).toHaveBeenCalledWith(
      [FORMER_CHARGE_ID, FORMER_CHARGE_ID],
      expect.anything(),
      { keepChargeIds: [NEW_CHARGE_ID] },
    );
    expect(result).toMatchObject({ deletedChargeIds: [FORMER_CHARGE_ID] });
  });

  it('updateTransaction: skips the cleanup when the charge is not changed', async () => {
    const { context } = buildContext();

    await run(
      'updateTransaction',
      { transactionId: TX_1, fields: { counterpartyId: OWNER_ID } },
      context,
    );

    expect(deleteChargesIfEmpty).not.toHaveBeenCalled();
  });

  it('updateTransactions: skips the cleanup when the charge is not changed', async () => {
    const { context } = buildContext();

    const result = await run(
      'updateTransactions',
      { transactionIds: [TX_1, TX_2], fields: { counterpartyId: OWNER_ID } },
      context,
    );

    expect(deleteChargesIfEmpty).not.toHaveBeenCalled();
    expect(result).toMatchObject({ deletedChargeIds: [] });
  });
});

/**
 * Unlinking (`chargeId: EMPTY_UUID`) transactions that sit on no charge is a no-op for the charge.
 * The sentinel used to reach the SQL as-is, which tried to write the nil UUID as the charge ID and
 * failed on the foreign key — failing the whole update, other fields included.
 */
describe('transactions mutations — unlinking charge-less transactions', () => {
  beforeEach(() => {
    vi.mocked(deleteChargesIfEmpty).mockReset().mockResolvedValue([]);
    vi.mocked(degradeChargesAccountantApproval).mockReset().mockResolvedValue(new Map());
  });

  it('updateTransaction: leaves the charge untouched instead of writing the sentinel', async () => {
    const { context, generateCharge, updateTransactions } = buildContext({ formerChargeId: null });

    await run(
      'updateTransaction',
      { transactionId: TX_1, fields: { chargeId: EMPTY_UUID, isFee: true } },
      context,
    );

    expect(generateCharge).not.toHaveBeenCalled();
    expect(updateTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ transactionIds: [TX_1], chargeId: null, isFee: true }),
    );
  });

  it('updateTransactions: leaves the charge untouched instead of writing the sentinel', async () => {
    const { context, generateCharge, updateTransactions } = buildContext({ formerChargeId: null });

    await run(
      'updateTransactions',
      { transactionIds: [TX_1, TX_2], fields: { chargeId: EMPTY_UUID, isFee: true } },
      context,
    );

    expect(generateCharge).not.toHaveBeenCalled();
    expect(updateTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ transactionIds: [TX_1, TX_2], chargeId: null, isFee: true }),
    );
  });
});
