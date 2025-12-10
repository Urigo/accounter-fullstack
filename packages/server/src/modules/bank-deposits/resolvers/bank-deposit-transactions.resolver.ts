import { GraphQLError } from 'graphql';
import { Currency } from '../../../shared/enums.js';
import { dateToTimelessDateString, formatFinancialAmount } from '../../../shared/helpers/index.js';
import { identifyInterestTransactionIds } from '../../ledger/helpers/bank-deposit-ledger-generation.helper.js';
import { BankDepositTransactionsProvider } from '../providers/bank-deposit-transactions.provider.js';
import type { BankDepositsModule } from '../types.js';

export const bankDepositTransactionsResolvers: BankDepositsModule.Resolvers = {
  Query: {
    deposit: async (_, { depositId }, { injector, adminContext: { defaultLocalCurrency } }) => {
      try {
        const transactions = await injector
          .get(BankDepositTransactionsProvider)
          .getTransactionsByBankDepositLoader.load(depositId);

        // Identify interest transactions via shared helper
        const interestTransactionIds = identifyInterestTransactionIds(transactions, {
          getId: t => t.id,
          getChargeId: t => t.charge_id,
          getAmount: t => Number(t.amount ?? 0),
        });

        let currentBalance = 0;
        let totalInterest = 0;
        let totalDeposit = 0;
        for (const tx of transactions) {
          const amount = Number(tx.amount);
          if (interestTransactionIds.has(tx.id)) {
            totalInterest += amount;
          } else {
            currentBalance += amount;
            if (amount > 0) {
              totalDeposit += amount;
            }
          }
        }

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
          if (!interestTransactionIds.has(tx.id)) {
            runningBalance += Number(tx.amount);
          }
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
          totalInterest: formatFinancialAmount(totalInterest),
          totalDeposit: formatFinancialAmount(totalDeposit),
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
    depositByCharge: async (
      _,
      { chargeId },
      { injector, adminContext: { defaultLocalCurrency } },
    ) => {
      try {
        const transactions = await injector
          .get(BankDepositTransactionsProvider)
          .getDepositTransactionsByChargeId(chargeId, true);

        // Identify interest transactions via shared helper
        const interestTransactionIds = identifyInterestTransactionIds(transactions, {
          getId: t => t.id,
          getChargeId: t => t.charge_id,
          getAmount: t => Number(t.amount ?? 0),
        });

        let currentBalance = 0;
        let totalInterest = 0;
        let totalDeposit = 0;
        for (const tx of transactions) {
          const amount = Number(tx.amount);
          if (interestTransactionIds.has(tx.id)) {
            totalInterest += amount;
          } else {
            currentBalance += amount;
            if (amount > 0) {
              totalDeposit += amount;
            }
          }
        }

        const depositIds = new Set(
          transactions.map(tx => tx.deposit_id).filter(Boolean) as string[],
        );
        if (depositIds.size === 0) {
          return null;
        }
        if (depositIds.size > 1) {
          throw new GraphQLError('Multiple deposits found');
        }

        const id = [...depositIds][0];
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

        // Find closeDate
        let runningBalance = 0;
        let closeDate = null;
        for (const tx of sortedByDebit) {
          if (!interestTransactionIds.has(tx.id)) {
            runningBalance += Number(tx.amount);
          }
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
          totalInterest: formatFinancialAmount(totalInterest),
          totalDeposit: formatFinancialAmount(totalDeposit),
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
    allDeposits: async (_, __, { injector, adminContext: { defaultLocalCurrency } }) => {
      try {
        const deposits = await injector
          .get(BankDepositTransactionsProvider)
          .getAllDepositsWithMetadata();

        return deposits.map(deposit => ({
          id: deposit.id,
          currency: (deposit.currency as Currency) ?? defaultLocalCurrency,
          openDate: deposit.openDate ?? dateToTimelessDateString(new Date()),
          closeDate: deposit.closeDate,
          currentBalance: formatFinancialAmount(deposit.currentBalance, deposit.currency),
          totalDeposit: formatFinancialAmount(deposit.totalDeposit, deposit.currency),
          totalInterest: formatFinancialAmount(deposit.totalInterest, deposit.currency),
          isOpen: Math.abs(deposit.currentBalance) >= 0.005,
          currencyError: deposit.currencyError,
          transactions: deposit.transactionIds,
          balance: formatFinancialAmount(deposit.currentBalance, deposit.currency),
        }));
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
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
          totalInterest: formatFinancialAmount(0),
          totalDeposit: formatFinancialAmount(0),
          isOpen: false,
          currencyError: [],
          transactions: [],
          balance: formatFinancialAmount(0),
        };
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        throw new GraphQLError('Error creating deposit');
      }
    },
    assignTransactionToDeposit: async (
      _,
      { transactionId, depositId },
      { injector, adminContext: { defaultLocalCurrency } },
    ) => {
      try {
        const updatedDeposit = await injector
          .get(BankDepositTransactionsProvider)
          .assignTransactionToDeposit(transactionId, depositId);

        return {
          id: updatedDeposit.id,
          currency: (updatedDeposit.currency as Currency) ?? defaultLocalCurrency,
          openDate: updatedDeposit.openDate ?? dateToTimelessDateString(new Date()),
          closeDate: updatedDeposit.closeDate,
          currentBalance: formatFinancialAmount(updatedDeposit.currentBalance),
          totalInterest: formatFinancialAmount(updatedDeposit.totalInterest),
          totalDeposit: formatFinancialAmount(updatedDeposit.totalDeposit),
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
