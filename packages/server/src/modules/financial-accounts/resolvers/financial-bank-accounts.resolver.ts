import { GraphQLError } from 'graphql';
import { FinancialBankAccountsProvider } from '../providers/financial-bank-accounts.provider.js';
import type { FinancialAccountsModule, IGetFinancialBankAccountsByIdsResult } from '../types.js';
import { commonFinancialAccountFields } from './common.js';

function validateBankAccount(
  bankAccount: IGetFinancialBankAccountsByIdsResult | undefined,
): IGetFinancialBankAccountsByIdsResult {
  if (!bankAccount) {
    throw new GraphQLError('Bank account not found');
  }
  return bankAccount;
}

export const financialBankAccountsResolvers: FinancialAccountsModule.Resolvers = {
  Query: {
    // allFinancialAccounts: async (_, __, { injector }) => {
    //   return injector.get(FinancialAccountsProvider).getAllFinancialAccounts();
    // },
  },
  BankFinancialAccount: {
    __isTypeOf: DbAccount => DbAccount.type === 'BANK_ACCOUNT',
    ...commonFinancialAccountFields,
    accountNumber: DbAccount => DbAccount.account_number,
    bankNumber: async (DbAccount, _, { injector }) =>
      injector
        .get(FinancialBankAccountsProvider)
        .getFinancialBankAccountByIdLoader.load(DbAccount.id)
        .then(validateBankAccount)
        .then(bankAccount => bankAccount.bank_number.toString()),
    branchNumber: async (DbAccount, _, { injector }) =>
      injector
        .get(FinancialBankAccountsProvider)
        .getFinancialBankAccountByIdLoader.load(DbAccount.id)
        .then(validateBankAccount)
        .then(bankAccount => bankAccount.branch_number.toString()),
    name: async (DbAccount, _, { injector }) =>
      injector
        .get(FinancialBankAccountsProvider)
        .getFinancialBankAccountByIdLoader.load(DbAccount.id)
        .then(validateBankAccount)
        .then(bankAccount => `${bankAccount.bank_number}-${DbAccount.account_number}`),
  },
};
