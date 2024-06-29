import { GraphQLError } from 'graphql';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { Maybe, ResolverFn, ResolversParentTypes } from '@shared/gql-types';
import { formatAmount } from '@shared/helpers';
import { Suggestion } from './charge-suggestions.resolver.js';

export const missingConversionInfoSuggestions: ResolverFn<
  Maybe<Suggestion>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  object
> = async (DbCharge, _, { injector }) => {
  const transactions = await injector
    .get(TransactionsProvider)
    .getTransactionsByChargeIDLoader.load(DbCharge.id);

  let fromCurrency: string | undefined;
  let toCurrency: string | undefined;

  for (const transaction of transactions) {
    if (transaction.is_fee) continue;
    const amount = formatAmount(transaction.amount);
    if (amount > 0) {
      if (toCurrency) {
        throw new GraphQLError('Multiple destination currencies in Kraken conversion');
      }
      toCurrency = transaction.currency;
    }
    if (amount < 0) {
      if (fromCurrency) {
        throw new GraphQLError('Multiple source currencies in Kraken conversion');
      }
      fromCurrency = transaction.currency;
    }
    if (fromCurrency && toCurrency) {
      return {
        description: `${fromCurrency} to ${toCurrency} conversion`,
        tags: [],
      };
    }
  }

  return null;
};
