import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import { MiscExpensesProvider } from '../providers/misc-expenses.provider.js';
import type { MiscExpensesModule } from '../types.js';
import { commonChargeFields } from './common.resolver.js';

export const miscExpensesLedgerEntriesResolvers: MiscExpensesModule.Resolvers = {
  Query: {
    miscExpensesByCharge: async (_, { chargeId }, { injector }) => {
      try {
        return await injector.get(MiscExpensesProvider).getExpensesByChargeIdLoader.load(chargeId);
      } catch (e) {
        console.error('Error fetching misc expenses', e);
        throw new GraphQLError((e as Error)?.message ?? 'Error fetching misc expenses');
      }
    },
  },
  Mutation: {
    insertMiscExpense: async (_, { fields }, { injector }) => {
      try {
        return await injector
          .get(MiscExpensesProvider)
          .insertExpense(fields)
          .then(res => {
            if (!res.length) {
              throw new GraphQLError('Error inserting misc expense');
            }
            return res[0];
          });
      } catch (e) {
        console.error('Error inserting misc expense', e);
        throw new GraphQLError((e as Error)?.message ?? 'Error inserting misc expense');
      }
    },
    updateMiscExpense: async (_, { transactionId, counterpartyId, fields }, { injector }) => {
      try {
        return await injector
          .get(MiscExpensesProvider)
          .updateExpense({ transactionId, originalCounterpartyId: counterpartyId, ...fields })
          .then(res => {
            if (!res.length) {
              throw new GraphQLError('Error updating misc expense');
            }
            return res[0];
          });
      } catch (e) {
        console.error('Error updating misc expense', e);
        throw new GraphQLError((e as Error)?.message ?? 'Error updating misc expense');
      }
    },
  },
  MiscExpense: {
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
    counterparty: async (dbExpense, _, { injector }) =>
      injector
        .get(FinancialEntitiesProvider)
        .getFinancialEntityByIdLoader.load(dbExpense.counterparty)
        .then(entity => {
          if (!entity) {
            throw new GraphQLError(`Financial entity ID="${dbExpense.counterparty}" not found`);
          }
          return entity;
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
    date: dbExpense => (dbExpense.date ? dateToTimelessDateString(dbExpense.date) : null),
  },
  BankDepositCharge: commonChargeFields,
  BusinessTripCharge: commonChargeFields,
  CreditcardBankCharge: commonChargeFields,
  CommonCharge: commonChargeFields,
  ConversionCharge: commonChargeFields,
  DividendCharge: commonChargeFields,
  InternalTransferCharge: commonChargeFields,
  MonthlyVatCharge: commonChargeFields,
  FinancialCharge: commonChargeFields,
  SalaryCharge: commonChargeFields,
};
