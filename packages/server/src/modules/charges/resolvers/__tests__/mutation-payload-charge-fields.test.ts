import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import { ChargesProvider } from '../../providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../types.js';
import { chargesResolvers } from '../charges.resolver.js';

/**
 * The charge fields that let a transaction mutation payload carry the parent charge back to the
 * client (#4481): a change to a transaction moves its charge's amounts, dates, counts and approval,
 * and the client patches the charge from the payload.
 */

const CHARGE_ID = 'cc000000-0000-4000-8000-000000000001';
const TRANSACTION_ID = 'aa000000-0000-4000-8000-000000000001';

const storedCharge = { id: CHARGE_ID } as IGetChargesByIdsResult;

function context({
  charges = { [CHARGE_ID]: storedCharge },
  transactions = { [TRANSACTION_ID]: { id: TRANSACTION_ID, charge_id: CHARGE_ID } },
}: {
  charges?: Record<string, IGetChargesByIdsResult>;
  transactions?: Record<string, { id: string; charge_id: string }>;
} = {}) {
  const chargesProvider = {
    getChargeByIdLoader: { load: vi.fn(async (id: string) => charges[id]) },
  };
  const transactionsProvider = {
    transactionByIdLoader: {
      load: vi.fn(
        async (id: string) => transactions[id] ?? new Error(`Transaction ID="${id}" not found`),
      ),
    },
  };
  const injector = {
    get: (token: unknown) => {
      if (token === ChargesProvider) {
        return chargesProvider;
      }
      if (token === TransactionsProvider) {
        return transactionsProvider;
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;
  return { context: { injector } as never, chargesProvider };
}

type FieldResolver<Parent> = (parent: Parent, args: unknown, context: unknown) => Promise<unknown>;

describe('Transaction.charge', () => {
  const resolvers = [
    ['CommonTransaction', chargesResolvers.CommonTransaction],
    ['ConversionTransaction', chargesResolvers.ConversionTransaction],
  ] as const;

  it.each(resolvers)('%s resolves the charge the transaction belongs to', async (_, typeResolvers) => {
    const charge = (typeResolvers as { charge: FieldResolver<string> }).charge;
    const { context: ctx } = context();

    await expect(charge(TRANSACTION_ID, {}, ctx)).resolves.toBe(storedCharge);
  });

  it('throws when the charge is missing, since the field is non-null', async () => {
    const charge = (chargesResolvers.CommonTransaction as { charge: FieldResolver<string> }).charge;
    const { context: ctx } = context({ charges: {} });

    await expect(charge(TRANSACTION_ID, {}, ctx)).rejects.toThrow();
  });
});
