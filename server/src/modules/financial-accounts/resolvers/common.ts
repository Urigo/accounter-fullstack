import { FinancialAccountsProvider } from '../providers/financial-accounts.provider.js';
import type { FinancialAccountsModule } from '../types.js';

export const commonFinancialAccountFields:
  | FinancialAccountsModule.CardFinancialAccountResolvers
  | FinancialAccountsModule.BankFinancialAccountResolvers = {
  id: DbAccount => DbAccount.id,
};

export const commonTransactionFields:
  | FinancialAccountsModule.ConversionTransactionResolvers
  | FinancialAccountsModule.FeeTransactionResolvers
  | FinancialAccountsModule.WireTransactionResolvers
  | FinancialAccountsModule.CommonTransactionResolvers = {
  account: async (DbTransaction, _, { injector }) => {
    // TODO: enhance logic to be based on ID instead of account_number
    if (!DbTransaction.account_number) {
      throw new Error(`Transaction ID="${DbTransaction.id}" is missing account_number`);
    }
    const account = await injector
      .get(FinancialAccountsProvider)
      .getFinancialAccountByAccountNumberLoader.load(DbTransaction.account_number);
    if (!account) {
      throw new Error(`Account number "${DbTransaction.account_number}" is missing`);
    }
    return account;
  },
};

export const commonFinancialEntityFields:
  | FinancialAccountsModule.LtdFinancialEntityResolvers
  | FinancialAccountsModule.PersonalFinancialEntityResolvers = {
  accounts: async (DbBusiness, _, { injector }) => {
    // TODO: add functionality for linkedEntities data
    const accounts = await injector
      .get(FinancialAccountsProvider)
      .getFinancialAccountsByFinancialEntityIdLoader.load(DbBusiness.id);
    return accounts;
  },
};
