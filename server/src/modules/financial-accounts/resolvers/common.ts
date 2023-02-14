import {
  getFinancialAccountByAccountNumberLoader,
  getFinancialAccountsByFinancialEntityIdLoader,
} from '../../../providers/financial-accounts.js';
import type { FinancialAccountsModule } from '../__generated__/types.js';

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
  account: async DbTransaction => {
    // TODO: enhance logic to be based on ID instead of account_number
    if (!DbTransaction.account_number) {
      throw new Error(`Transaction ID="${DbTransaction.id}" is missing account_number`);
    }
    const account = await getFinancialAccountByAccountNumberLoader.load(
      DbTransaction.account_number,
    );
    if (!account) {
      throw new Error(`Account number "${DbTransaction.account_number}" is missing`);
    }
    return account;
  },
};

export const commonFinancialEntityFields:
  | FinancialAccountsModule.LtdFinancialEntityResolvers
  | FinancialAccountsModule.PersonalFinancialEntityResolvers = {
  accounts: async DbBusiness => {
    // TODO: add functionality for linkedEntities data
    const accounts = await getFinancialAccountsByFinancialEntityIdLoader.load(DbBusiness.id);
    return accounts;
  },
};
