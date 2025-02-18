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
        const message = 'Error fetching misc expenses by charge';
        console.error(`${message}: ${e}`);
        throw new GraphQLError(message);
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
              throw new Error('Error inserting misc expense');
            }
            return res[0];
          });
      } catch (e) {
        const message = 'Error inserting misc expense';
        console.error(`${message}: ${e}`);
        throw new GraphQLError(message);
      }
    },
    updateMiscExpense: async (_, { id, fields }, { injector }) => {
      try {
        return await injector
          .get(MiscExpensesProvider)
          .updateExpense({ miscExpenseId: id, ...fields })
          .then(res => {
            if (!res.length) {
              throw new Error('Error updating misc expense');
            }
            return res[0];
          });
      } catch (e) {
        const message = 'Error updating misc expense';
        console.error(`${message}: ${e}`);
        throw new GraphQLError(message);
      }
    },
    deleteMiscExpense: async (_, { id }, { injector }) => {
      try {
        return await injector
          .get(MiscExpensesProvider)
          .deleteMiscExpense({ id })
          .then(() => true);
      } catch (e) {
        const message = 'Error deleting misc expense';
        console.error(`${message}: ${e}`);
        throw new GraphQLError(message);
      }
    },
  },
  MiscExpense: {
    id: dbExpense => dbExpense.id,
    chargeId: dbExpense => dbExpense.charge_id,
    charge: async (dbExpense, _, { injector }) => {
      try {
        return injector
          .get(ChargesProvider)
          .getChargeByIdLoader.load(dbExpense.charge_id)
          .then(charge => {
            if (!charge) {
              throw new Error(`Charge ID="${dbExpense.charge_id}" not found`);
            }
            return charge;
          });
      } catch (error) {
        const message = 'Error fetching misc expense charge';
        console.error(`${message}: ${error}`);
        throw new GraphQLError(message);
      }
    },
    creditor: async (dbExpense, _, { injector }) => {
      try {
        return injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(dbExpense.creditor_id)
          .then(entity => {
            if (!entity) {
              throw new Error(`Financial entity ID="${dbExpense.creditor_id}" not found`);
            }
            return entity;
          });
      } catch (error) {
        const message = 'Error fetching misc expense creditor';
        console.error(`${message}: ${error}`);
        throw new GraphQLError(message);
      }
    },
    debtor: async (dbExpense, _, { injector }) => {
      try {
        return injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(dbExpense.debtor_id)
          .then(entity => {
            if (!entity) {
              throw new Error(`Financial entity ID="${dbExpense.debtor_id}" not found`);
            }
            return entity;
          });
      } catch (error) {
        const message = 'Error fetching misc expense debtor';
        console.error(`${message}: ${error}`);
        throw new GraphQLError(message);
      }
    },
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
