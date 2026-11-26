import { GraphQLError } from 'graphql';
import { ScopeProvider } from '../../auth/providers/scope.provider.js';
import { TransactionsProvider } from '../providers/transactions.provider.js';
import type { TransactionsModule } from '../types.js';

export const MAX_GROUP_SAMPLE_SIZE = 500;
export const MAX_GROUPS_PER_PAGE = 1000;

type RawTotal = { currency: string; amount: number | string; count: number };

function inRange(name: string, value: number, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new GraphQLError(`${name} must be an integer between ${min} and ${max}`);
  }
}

export const uncategorizedTransactionGroupsResolvers: TransactionsModule.Resolvers = {
  Query: {
    uncategorizedTransactionGroups: async (
      _,
      { filters, sampleSize = 5, limit = 200, offset = 0 },
      { injector },
    ) => {
      const sample = sampleSize ?? 5;
      const pageSize = limit ?? 200;
      const skip = offset ?? 0;
      inRange('sampleSize', sample, 1, MAX_GROUP_SAMPLE_SIZE);
      inRange('limit', pageSize, 1, MAX_GROUPS_PER_PAGE);
      inRange('offset', skip, 0, Number.MAX_SAFE_INTEGER);
      if (filters?.minCount != null) {
        inRange('minCount', filters.minCount, 1, Number.MAX_SAFE_INTEGER);
      }

      // getReadScope narrows the authorized scope by the requested owners (throwing if any are
      // outside it), so byOwners can never broaden access.
      const ownerIds = await injector
        .get(ScopeProvider)
        .getReadScope(filters?.byOwners ? [...filters.byOwners] : undefined);
      // The query filters on `owner_id = ANY(...)`, so an empty scope already returns nothing;
      // answering here just skips the round trip.
      if (ownerIds.length === 0 || filters?.keys?.length === 0) {
        return { totalGroups: 0, totalTransactions: 0, groups: [] };
      }

      const rows = await injector.get(TransactionsProvider).getUncategorizedTransactionGroups({
        ownerIds,
        fromEventDate: filters?.fromEventDate ?? null,
        toEventDate: filters?.toEventDate ?? null,
        keys: filters?.keys ? [...filters.keys] : null,
        minCount: filters?.minCount ?? null,
        sampleSize: sample,
        limit: pageSize,
        offset: skip,
      });

      return {
        // A page past the end has no rows to carry the window totals; report it as empty.
        totalGroups: rows[0]?.total_groups ?? 0,
        totalTransactions: rows[0]?.total_transactions ?? 0,
        groups: rows.map(row => ({
          key: row.key ?? '',
          sampleDescription: row.sample_description,
          transactionCount: row.transaction_count ?? 0,
          chargeCount: row.charge_count ?? 0,
          totals: ((row.totals ?? []) as RawTotal[]).map(total => ({
            currency: total.currency as never,
            amount: Number(total.amount),
            transactionCount: total.count,
          })),
          minEventDate: row.min_event_date as never,
          maxEventDate: row.max_event_date as never,
          transactionIds: (row.transaction_ids ?? []) as string[],
          chargeIds: (row.charge_ids ?? []) as string[],
        })),
      };
    },
  },
};
