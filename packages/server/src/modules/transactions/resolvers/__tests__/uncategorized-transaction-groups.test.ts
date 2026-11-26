import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { ScopeProvider } from '../../../auth/providers/scope.provider.js';
import { TransactionsProvider } from '../../providers/transactions.provider.js';
import {
  MAX_GROUP_SAMPLE_SIZE,
  uncategorizedTransactionGroupsResolvers,
} from '../uncategorized-transaction-groups.resolver.js';

/**
 * `Query.uncategorizedTransactionGroups` narrows the owners to the read scope, passes the filters
 * to one grouped SQL query and maps its rows. The grouping itself is SQL and is not exercised here.
 */

const O1 = 'aa000000-0000-4000-8000-000000000001';
const O2 = 'aa000000-0000-4000-8000-000000000002';

type Args = {
  filters?: Record<string, unknown> | null;
  sampleSize?: number;
  limit?: number;
  offset?: number;
};

const resolve = uncategorizedTransactionGroupsResolvers.Query!
  .uncategorizedTransactionGroups as unknown as (
  parent: unknown,
  args: Args,
  context: unknown,
) => Promise<{
  totalGroups: number;
  totalTransactions: number;
  groups: Array<Record<string, unknown>>;
}>;

const ROW = {
  key: 'paypal *acme #',
  sample_description: 'PAYPAL *ACME 1234',
  transaction_count: 3,
  charge_count: 2,
  totals: [
    { currency: 'USD', amount: -25, count: 2 },
    { currency: 'ILS', amount: '-40.5', count: 1 },
  ],
  min_event_date: '2026-01-05',
  max_event_date: '2026-03-01',
  transaction_ids: ['t1', 't2'],
  charge_ids: ['c1'],
  total_groups: 7,
  total_transactions: 41,
};

function setup({ scope = [O1], rows = [ROW] }: { scope?: string[]; rows?: unknown[] } = {}) {
  const getReadScope = vi.fn(async (requested?: string[]) => requested ?? scope);
  const getUncategorizedTransactionGroups = vi.fn(async () => rows);
  const injector = {
    get: (token: unknown) => {
      if (token === ScopeProvider) return { getReadScope };
      if (token === TransactionsProvider) return { getUncategorizedTransactionGroups };
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;
  return { context: { injector } as never, getReadScope, getUncategorizedTransactionGroups };
}

describe('Query.uncategorizedTransactionGroups', () => {
  it('maps rows to groups and reports the totals across pages', async () => {
    const { context } = setup();

    const result = await resolve(null, { sampleSize: 5, limit: 200, offset: 0 }, context);

    expect(result.totalGroups).toBe(7);
    expect(result.totalTransactions).toBe(41);
    expect(result.groups).toEqual([
      {
        key: 'paypal *acme #',
        sampleDescription: 'PAYPAL *ACME 1234',
        transactionCount: 3,
        chargeCount: 2,
        totals: [
          { currency: 'USD', amount: -25, transactionCount: 2 },
          { currency: 'ILS', amount: -40.5, transactionCount: 1 },
        ],
        minEventDate: '2026-01-05',
        maxEventDate: '2026-03-01',
        transactionIds: ['t1', 't2'],
        chargeIds: ['c1'],
      },
    ]);
  });

  it('passes the scoped owners and every filter to the query', async () => {
    const { context, getReadScope, getUncategorizedTransactionGroups } = setup();

    await resolve(
      null,
      {
        filters: {
          byOwners: [O2],
          fromEventDate: '2026-01-01',
          toEventDate: '2026-12-31',
          keys: ['paypal *acme #'],
          minCount: 2,
        },
        sampleSize: 50,
        limit: 10,
        offset: 20,
      },
      context,
    );

    expect(getReadScope).toHaveBeenCalledWith([O2]);
    expect(getUncategorizedTransactionGroups).toHaveBeenCalledWith({
      ownerIds: [O2],
      fromEventDate: '2026-01-01',
      toEventDate: '2026-12-31',
      keys: ['paypal *acme #'],
      minCount: 2,
      sampleSize: 50,
      limit: 10,
      offset: 20,
    });
  });

  it('answers an empty read scope or an empty key list without querying', async () => {
    for (const [scope, filters] of [
      [[], null],
      [[O1], { keys: [] }],
    ] as const) {
      const { context, getUncategorizedTransactionGroups } = setup({ scope: [...scope] });
      const result = await resolve(
        null,
        { filters: filters as Args['filters'], sampleSize: 5, limit: 200, offset: 0 },
        context,
      );
      expect(result).toEqual({ totalGroups: 0, totalTransactions: 0, groups: [] });
      expect(getUncategorizedTransactionGroups).not.toHaveBeenCalled();
    }
  });

  it('reports a page past the end as empty', async () => {
    const { context } = setup({ rows: [] });

    const result = await resolve(null, { sampleSize: 5, limit: 200, offset: 5000 }, context);

    expect(result).toEqual({ totalGroups: 0, totalTransactions: 0, groups: [] });
  });

  it.each([
    [{ sampleSize: 0 }, /sampleSize/],
    [{ sampleSize: MAX_GROUP_SAMPLE_SIZE + 1 }, /sampleSize/],
    [{ limit: 0 }, /limit/],
    [{ offset: -1 }, /offset/],
    [{ filters: { minCount: 0 } }, /minCount/],
  ])('refuses out-of-range paging %o', async (args, message) => {
    const { context, getUncategorizedTransactionGroups } = setup();

    await expect(
      resolve(null, { sampleSize: 5, limit: 200, offset: 0, ...args }, context),
    ).rejects.toThrow(message);
    expect(getUncategorizedTransactionGroups).not.toHaveBeenCalled();
  });
});
