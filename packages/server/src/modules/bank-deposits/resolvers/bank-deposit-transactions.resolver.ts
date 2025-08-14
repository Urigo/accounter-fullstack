import { GraphQLError } from 'graphql';
import { formatFinancialAmount } from '@shared/helpers';
import { BankDepositTransactionsProvider } from '../providers/bank-deposit-transactions.provider.js';
import type { BankDepositsModule } from '../types.js';

export const bankDepositTransactionsResolvers: BankDepositsModule.Resolvers = {
  Query: {
    deposit: async (_, { depositId }, { injector }) => {
      try {
        const transactions = await injector
          .get(BankDepositTransactionsProvider)
          .getTransactionsByBankDepositLoader.load(depositId);
        const currentBalance = transactions.reduce((acc, tx) => acc + Number(tx.amount), 0);
        return {
          id: depositId,
          transactions: transactions.map(tx => tx.id),
          balance: formatFinancialAmount(currentBalance),
          isOpen: currentBalance <= 0,
        };
      } catch (e) {
        console.error('Error fetching bank deposit', e);
        throw new GraphQLError('Error fetching bank deposit');
      }
    },
    depositByCharge: async (_, { chargeId }, { injector }) => {
      try {
        const transactions = await injector
          .get(BankDepositTransactionsProvider)
          .getDepositTransactionsByChargeId(chargeId, true);
        const currentBalance = transactions.reduce((acc, tx) => acc + Number(tx.amount), 0);

        const depositIds = new Set(
          transactions.map(tx => tx.deposit_id).filter(Boolean) as string[],
        );
        if (depositIds.size === 0) {
          throw new GraphQLError('No deposits found');
        }
        if (depositIds.size > 1) {
          throw new GraphQLError('Multiple deposits found');
        }

        const id = [...depositIds][0];
        return {
          id,
          transactions: transactions.map(tx => tx.id),
          balance: formatFinancialAmount(currentBalance),
          isOpen: currentBalance <= 0,
        };
      } catch (e) {
        console.error('Error fetching bank deposit', e);
        throw new GraphQLError('Error fetching bank deposit');
      }
    },
  },
};
