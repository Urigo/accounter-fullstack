import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
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
    updateMiscExpense: async (_, { id, fields }, { injector }) => {
      try {
        return await injector
          .get(MiscExpensesProvider)
          .updateExpense({ miscExpenseId: id, ...fields })
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
    deleteMiscExpense: async (_, { id }, { injector }) => {
      try {
        return await injector
          .get(MiscExpensesProvider)
          .deleteMiscExpense({ id })
          .then(() => true);
      } catch (e) {
        console.error('Error deleting misc expense', e);
        throw new GraphQLError((e as Error)?.message ?? 'Error deleting misc expense');
      }
    },
  },
  MiscExpense: {
    id: dbExpense => dbExpense.id,
    chargeId: dbExpense => dbExpense.charge_id,
    charge: async (dbExpense, _, { injector }) =>
      injector
        .get(ChargesProvider)
        .getChargeByIdLoader.load(dbExpense.charge_id)
        .then(charge => {
          if (!charge) {
            throw new GraphQLError(`Charge ID="${dbExpense.charge_id}" not found`);
          }
          return charge;
        }),
    creditor: async (dbExpense, _, { injector }) =>
      injector
        .get(FinancialEntitiesProvider)
        .getFinancialEntityByIdLoader.load(dbExpense.creditor_id)
        .then(entity => {
          if (!entity) {
            throw new GraphQLError(`Financial entity ID="${dbExpense.creditor_id}" not found`);
          }
          return entity;
        }),
    debtor: async (dbExpense, _, { injector }) =>
      injector
        .get(FinancialEntitiesProvider)
        .getFinancialEntityByIdLoader.load(dbExpense.debtor_id)
        .then(entity => {
          if (!entity) {
            throw new GraphQLError(`Financial entity ID="${dbExpense.debtor_id}" not found`);
          }
          return entity;
        }),
    amount: dbExpense => formatFinancialAmount(dbExpense.amount, dbExpense.currency),
    description: dbExpense => dbExpense.description,
    invoiceDate: dbExpense => dateToTimelessDateString(dbExpense.invoice_date),
    valueDate: dbExpense => dateToTimelessDateString(dbExpense.value_date),
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
