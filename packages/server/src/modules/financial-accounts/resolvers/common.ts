import { FinancialAccountsProvider } from '../providers/financial-accounts.provider.js';
import type { FinancialAccountsModule } from '../types.js';

export const commonFinancialAccountFields: FinancialAccountsModule.FinancialAccountResolvers = {
  id: DbAccount => DbAccount.id,
  type: DbAccount => DbAccount.type,
};

export const commonTransactionFields:
  | FinancialAccountsModule.ConversionTransactionResolvers
  | FinancialAccountsModule.FeeTransactionResolvers
  | FinancialAccountsModule.WireTransactionResolvers
  | FinancialAccountsModule.CommonTransactionResolvers = {
  account: async (DbTransaction, _, { injector }) => {
    if (!DbTransaction.account_id) {
      throw new Error(`Transaction ID="${DbTransaction.id}" is missing account_id`);
    }
    const account = await injector
      .get(FinancialAccountsProvider)
      .getFinancialAccountByAccountIDLoader.load(DbTransaction.account_id);
    if (!account) {
      throw new Error(`Account ID "${DbTransaction.account_id}" is missing`);
    }
    return account;
  },
};

export const commonFinancialEntityFields:
  | FinancialAccountsModule.LtdFinancialEntityResolvers
  | FinancialAccountsModule.PersonalFinancialEntityResolvers = {
  accounts: async (DbBusiness, _, { injector }) => {
    const accounts = await injector
      .get(FinancialAccountsProvider)
      .getFinancialAccountsByOwnerIdLoader.load(DbBusiness.id);
    return accounts;
  },
};
