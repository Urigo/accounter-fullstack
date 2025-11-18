import { GraphQLError } from 'graphql';
import { Currency } from '@shared/gql-types';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import { BankDepositTransactionsProvider } from '../providers/bank-deposit-transactions.provider.js';
import type { BankDepositsModule } from '../types.js';

export const bankDepositTransactionsResolvers: BankDepositsModule.Resolvers = {
  Query: {
    deposit: async (_, { depositId }, { injector, adminContext: { defaultLocalCurrency } }) => {
      try {
        const transactions = await injector
          .get(BankDepositTransactionsProvider)
          .getTransactionsByBankDepositLoader.load(depositId);
        const currentBalance = transactions.reduce((acc, tx) => acc + Number(tx.amount), 0);

        const currency = (transactions[0]?.currency ?? defaultLocalCurrency) as Currency;
        const sortedByDebit = [...transactions].sort((a, b) => {
          const ad = a.debit_date ?? a.event_date;
          const bd = b.debit_date ?? b.event_date;
          return ad.getTime() - bd.getTime();
        });
        const openDate =
          sortedByDebit.length > 0
            ? dateToTimelessDateString(
                (sortedByDebit[0].debit_date ?? sortedByDebit[0].event_date) as Date,
              )
            : dateToTimelessDateString(new Date());

        // Find closeDate (last transaction where running balance reached zero)
        let runningBalance = 0;
        let closeDate = null;
        for (const tx of sortedByDebit) {
          runningBalance += Number(tx.amount);
          if (Math.abs(runningBalance) < 0.005) {
            closeDate = dateToTimelessDateString((tx.debit_date ?? tx.event_date) as Date);
          }
        }

        // If final balance is not closed, ensure closeDate is null
        if (Math.abs(currentBalance) >= 0.005) {
          closeDate = null;
        }

        // Check for currency conflicts
        const currencies = new Set(transactions.map(tx => tx.currency));
        const currencyError =
          currencies.size > 1
            ? transactions.filter(tx => tx.currency !== currency).map(tx => tx.id)
            : [];

        return {
          id: depositId,
          currency,
          openDate,
          closeDate,
          currentBalance: formatFinancialAmount(currentBalance),
          isOpen: Math.abs(currentBalance) >= 0.005,
          currencyError,
          transactions: transactions.map(tx => tx.id),
          balance: formatFinancialAmount(currentBalance),
        };
      } catch {
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
        const currency = (transactions[0]?.currency ?? 'ILS') as Currency;
        const sortedByDebit = [...transactions].sort((a, b) => {
          const ad = a.debit_date ?? a.event_date;
          const bd = b.debit_date ?? b.event_date;
          return ad.getTime() - bd.getTime();
        });
        const openDate =
          sortedByDebit.length > 0
            ? dateToTimelessDateString(
                (sortedByDebit[0].debit_date ?? sortedByDebit[0].event_date) as Date,
              )
            : dateToTimelessDateString(new Date());

        // Find closeDate
        let runningBalance = 0;
        let closeDate = null;
        for (const tx of sortedByDebit) {
          runningBalance += Number(tx.amount);
          if (Math.abs(runningBalance) < 0.005) {
            closeDate = dateToTimelessDateString((tx.debit_date ?? tx.event_date) as Date);
          }
        }

        // If final balance is not closed, ensure closeDate is null
        if (Math.abs(currentBalance) >= 0.005) {
          closeDate = null;
        }

        const currencies = new Set(transactions.map(tx => tx.currency));
        const currencyError =
          currencies.size > 1
            ? transactions.filter(tx => tx.currency !== currency).map(tx => tx.id)
            : [];

        return {
          id,
          currency,
          openDate,
          closeDate,
          currentBalance: formatFinancialAmount(currentBalance),
          isOpen: Math.abs(currentBalance) >= 0.005,
          currencyError,
          transactions: transactions.map(tx => tx.id),
          balance: formatFinancialAmount(currentBalance),
        };
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        throw new GraphQLError('Error fetching bank deposit');
      }
    },
    allDeposits: async (_, __, { injector }) => {
      try {
        const deposits = await injector
          .get(BankDepositTransactionsProvider)
          .getAllDepositsWithMetadata();

        return deposits.map(deposit => ({
          id: deposit.id,
          currency: (deposit.currency as Currency) ?? Currency.Ils,
          openDate: deposit.openDate ?? dateToTimelessDateString(new Date()),
          closeDate: deposit.closeDate,
          currentBalance: formatFinancialAmount(deposit.currentBalance),
          isOpen: Math.abs(deposit.currentBalance) >= 0.005,
          currencyError: deposit.currencyError,
          transactions: deposit.transactionIds,
          balance: formatFinancialAmount(deposit.currentBalance),
        }));
      } catch {
        throw new GraphQLError('Error fetching all deposits');
      }
    },
  },
  Mutation: {
    createDeposit: async (_, { currency }, { injector }) => {
      try {
        const deposit = await injector.get(BankDepositTransactionsProvider).createDeposit(currency);

        return {
          id: deposit.id,
          currency: currency as Currency,
          openDate: dateToTimelessDateString(new Date()),
          closeDate: null,
          currentBalance: formatFinancialAmount(0),
          isOpen: false,
          currencyError: [],
          transactions: [],
          balance: formatFinancialAmount(0),
        };
      } catch {
        throw new GraphQLError('Error creating deposit');
      }
    },
    assignTransactionToDeposit: async (_, { transactionId, depositId }, { injector }) => {
      try {
        const updatedDeposit = await injector
          .get(BankDepositTransactionsProvider)
          .assignTransactionToDeposit(transactionId, depositId);

        return {
          id: updatedDeposit.id,
          currency: (updatedDeposit.currency as Currency) ?? Currency.Ils,
          openDate: updatedDeposit.openDate ?? dateToTimelessDateString(new Date()),
          closeDate: updatedDeposit.closeDate,
          currentBalance: formatFinancialAmount(updatedDeposit.currentBalance),
          isOpen: Math.abs(updatedDeposit.currentBalance) >= 0.005,
          currencyError: updatedDeposit.currencyError,
          transactions: updatedDeposit.transactionIds,
          balance: formatFinancialAmount(updatedDeposit.currentBalance),
        };
      } catch (e) {
        throw new GraphQLError((e as Error).message || 'Error assigning transaction to deposit');
      }
    },
  },
};
