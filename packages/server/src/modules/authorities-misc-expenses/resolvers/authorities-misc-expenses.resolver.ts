import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { formatFinancialAmount } from '@shared/helpers';
import { AuthoritiesMiscExpensesProvider } from '../providers/authorities-misc-expenses.provider.js';
import type { AuthoritiesMiscExpensesModule } from '../types.js';

export const authoritiesMiscExpensesLedgerEntriesResolvers: AuthoritiesMiscExpensesModule.Resolvers =
  {
    Query: {
      getAuthoritiesExpensesByCharge: async (_, { chargeId }, { injector }) => {
        try {
          return await injector
            .get(AuthoritiesMiscExpensesProvider)
            .getExpensesByChargeIdLoader.load(chargeId);
        } catch (e) {
          console.error('Error fetching authorities misc expenses', e);
          throw new GraphQLError(
            (e as Error)?.message ?? 'Error fetching authorities misc expenses',
          );
        }
      },
    },
    AuthoritiesExpense: {
      transaction: async (dbExpense, _, { injector }) =>
        injector
          .get(TransactionsProvider)
          .getTransactionByIdLoader.load(dbExpense.transaction_id)
          .then(transaction => {
            if (!transaction) {
              throw new GraphQLError(`Transaction ID="${dbExpense.transaction_id}" not found`);
            }
            return transaction;
          }),
      transactionId: dbExpense => dbExpense.transaction_id,
      charge: async (dbExpense, _, { injector }) =>
        injector
          .get(ChargesProvider)
          .getChargeByTransactionIdLoader.load(dbExpense.transaction_id)
          .then(charge => {
            if (!charge) {
              throw new GraphQLError(
                `Charge for transaction ID="${dbExpense.transaction_id}" not found`,
              );
            }
            return charge;
          }),
      amount: async (dbExpense, _, { injector }) => {
        const transaction = await injector
          .get(TransactionsProvider)
          .getTransactionByIdLoader.load(dbExpense.transaction_id);
        if (!transaction) {
          throw new GraphQLError(`Transaction ID="${dbExpense.transaction_id}" not found`);
        }
        return formatFinancialAmount(dbExpense.amount, transaction.currency);
      },
      description: dbExpense => dbExpense.description,
    },
  };
