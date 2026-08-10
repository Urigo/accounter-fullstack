import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { TransactionsProvider } from '../../providers/transactions.provider.js';
import { commonTransactionFields } from '../common.js';

/**
 * `Transaction.ownerId`.
 *
 * Transactions used to expose no owner at all, which left any multi-business
 * consumer — the MCP connector above all — unable to attribute a merged result:
 * every other entity (charge, document, tag, tax category, business) names its
 * owner, transactions did not. The field is served straight off the row the
 * shared `transactionByIdLoader` already fetches, so it must not add a query of
 * its own; the parent is a transaction *id*, not a row, so reading it wrong is
 * easy and silent.
 */

const OWNER = 'bb000000-0000-4000-8000-000000000001';

function contextWithTransaction(row: Record<string, unknown>) {
  const load = vi.fn().mockResolvedValue(row);
  const injector = {
    get: (token: unknown) => {
      if (token === TransactionsProvider) {
        return { transactionByIdLoader: { load } };
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;
  return { context: { injector } as never, load };
}

describe('Transaction.ownerId', () => {
  it('resolves the owner from the transaction row', async () => {
    const { context, load } = contextWithTransaction({ id: 'tx1', owner_id: OWNER });

    const ownerId = await commonTransactionFields.ownerId!('tx1' as never, {}, context, {} as never);

    expect(ownerId).toBe(OWNER);
    expect(load).toHaveBeenCalledWith('tx1');
  });

  // Fields here share one DataLoader over the whole selection set; fetching the
  // owner any other way would add a query per transaction to every response.
  it('reads through the shared loader exactly once', async () => {
    const { context, load } = contextWithTransaction({ id: 'tx1', owner_id: OWNER });

    await commonTransactionFields.ownerId!('tx1' as never, {}, context, {} as never);

    expect(load).toHaveBeenCalledTimes(1);
  });
});
