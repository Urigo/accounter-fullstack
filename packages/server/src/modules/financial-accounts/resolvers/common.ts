import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { FinancialAccountsProvider } from '../providers/financial-accounts.provider.js';
import type { FinancialAccountsModule } from '../types.js';

export const commonFinancialAccountFields: FinancialAccountsModule.FinancialAccountResolvers = {
  id: DbAccount => DbAccount.id,
  type: DbAccount => DbAccount.type,
};

export const commonTransactionFields:
  | FinancialAccountsModule.ConversionTransactionResolvers
  | FinancialAccountsModule.CommonTransactionResolvers = {
  account: async (transactionId, _, { injector }) => {
    const transaction = await injector
      .get(TransactionsProvider)
      .transactionByIdLoader.load(transactionId);
    if (!transaction.account_id) {
      throw new Error(`Transaction ID="${transactionId}" is missing account_id`);
    }
    const account = await injector
      .get(FinancialAccountsProvider)
      .getFinancialAccountByAccountIDLoader.load(transaction.account_id);
    if (!account) {
      throw new Error(`Account ID "${transaction.account_id}" is missing`);
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
