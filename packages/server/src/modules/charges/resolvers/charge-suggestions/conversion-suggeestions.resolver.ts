import { GraphQLError } from 'graphql';
import { FeeTransactionsProvider } from '@modules/transactions/providers/fee-transactions.provider.js';
import { TransactionsNewProvider } from '@modules/transactions/providers/transactions-new.provider.js';
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
    .get(TransactionsNewProvider)
    .transactionsByChargeIDLoader.load(DbCharge.id);

  let fromCurrency: string | undefined;
  let toCurrency: string | undefined;

  for (const transaction of transactions) {
    const isFee = await injector
      .get(FeeTransactionsProvider)
      .getFeeTransactionByIdLoader.load(transaction.id)
      .then(Boolean);
    if (isFee) continue;
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
