import { GraphQLError } from 'graphql';
import { Currency } from '../../../shared/enums.js';
import { errorSimplifier } from '../../../shared/errors.js';
import { formatFinancialAmount } from '../../../shared/helpers/index.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import { BankDepositChargesProvider } from '../providers/bank-deposit-charges.provider.js';
import { BankDepositsProvider } from '../providers/bank-deposits.provider.js';
import type { BankDepositsModule } from '../types.js';

export const bankDepositChargesResolvers: BankDepositsModule.Resolvers = {
  Query: {
    depositByCharge: async (_, { chargeId }, { injector }) => {
      try {
        return await injector
          .get(BankDepositChargesProvider)
          .getBankDepositByChargeIdLoader.load(chargeId);
      } catch (e) {
        throw errorSimplifier('Error fetching deposit by charge', e);
      }
    },
  },
  Mutation: {
    assignChargeToDeposit: async (_, { chargeId, depositId }, { injector }) => {
      try {
        await injector.get(BankDepositChargesProvider).assignChargeToDeposit(chargeId, depositId);

        return injector
          .get(BankDepositChargesProvider)
          .getBankDepositByChargeIdLoader.load(chargeId)
          .then(deposit => {
            if (!deposit) {
              throw new GraphQLError('Deposit not found for charge after assignment');
            }
            return deposit;
          });
      } catch (e) {
        throw errorSimplifier('Error assigning transaction to deposit', e);
      }
    },
    createDepositFromCharge: async (_, { chargeId, name }, { injector }) => {
      try {
        const transactions = await injector
          .get(TransactionsProvider)
          .transactionsByChargeIDLoader.load(chargeId);

        if (transactions.length === 0) {
          throw new GraphQLError(
            'Deposit creation from charge requires charges that have at least one transaction',
          );
        }

        const currencies = new Set<Currency>();
        const accountIds = new Set<string>();
        let openDate: Date | null = null;
        transactions.map(t => {
          currencies.add(t.currency as Currency);
          if (t.account_id) {
            accountIds.add(t.account_id);
          }

          // Derive open_date from the earliest debit_date, falling back to event_date
          const transactionDate = t.debit_date ?? t.event_date;
          if (transactionDate && (!openDate || transactionDate < openDate)) {
            openDate = transactionDate;
          }
        });

        // Validate single currency and single account across all transactions
        if (currencies.size > 1) {
          throw new GraphQLError(
            `Cannot create deposit: charge has transactions in multiple currencies (${[...currencies].join(', ')})`,
          );
        }
        if (accountIds.size > 1) {
          throw new GraphQLError(
            `Cannot create deposit: charge has transactions from multiple accounts`,
          );
        }

        const currency = [...currencies][0];
        const accountId = [...accountIds][0] ?? null;

        const deposit = await injector.get(BankDepositsProvider).insertBankDeposit({
          name,
          currency,
          accountId,
          openDate,
          closeDate: null,
        });

        if (!deposit) {
          throw new GraphQLError('Failed to create bank deposit');
        }

        await injector
          .get(BankDepositChargesProvider)
          .upsertBankDepositCharge({ chargeId, depositId: deposit.id });
        injector.get(BankDepositChargesProvider).getBankDepositByChargeIdLoader.clear(chargeId);

        return deposit;
      } catch (e) {
        throw errorSimplifier('Error creating deposit from charge', e);
      }
    },
  },
  BankDeposit: {
    metadata: async (deposit, _, { injector }) => {
      try {
        return await injector
          .get(BankDepositChargesProvider)
          .getBankDepositMetadataLoader.load(deposit.id);
      } catch (e) {
        throw errorSimplifier(`Error fetching metadata for deposit ${deposit.name}`, e);
      }
    },
  },
  BankDepositMetadata: {
    id: metadata => metadata.id,
    currentBalance: metadata => formatFinancialAmount(metadata.currentBalance),
    totalInterest: metadata => formatFinancialAmount(metadata.totalInterest),
    totalDeposit: metadata => formatFinancialAmount(metadata.totalDeposit),
    potentialCloseDate: metadata =>
      Math.abs(metadata.currentBalance) >= 0.005 ? metadata.potentialCloseDate : null,
    transactions: metadata => metadata.transactionIds,
  },
};
