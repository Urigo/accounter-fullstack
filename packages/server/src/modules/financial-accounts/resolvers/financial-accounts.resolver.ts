import { FinancialAccountsProvider } from '../providers/financial-accounts.provider.js';
import type { FinancialAccountsModule } from '../types.js';
import {
  commonFinancialAccountFields,
  commonFinancialEntityFields,
  commonTransactionFields,
} from './common.js';

export const financialAccountsResolvers: FinancialAccountsModule.Resolvers = {
  Query: {
    allFinancialAccounts: async (_, __, { injector }) => {
      return injector.get(FinancialAccountsProvider).getAllFinancialAccounts();
    },
  },
  BankFinancialAccount: {
    __isTypeOf: DbAccount => DbAccount.type === 'BANK_ACCOUNT',
    ...commonFinancialAccountFields,
    accountNumber: DbAccount => DbAccount.account_number,
    bankNumber: DbAccount => DbAccount.bank_number!.toString(),
    branchNumber: DbAccount => DbAccount.branch_number!.toString(),
    name: DbAccount => `${DbAccount.bank_number}-${DbAccount.account_number}`,
  },
  CardFinancialAccount: {
    __isTypeOf: DbAccount => DbAccount.type === 'CREDIT_CARD',
    ...commonFinancialAccountFields,
    number: DbAccount => DbAccount.account_number,
    fourDigits: DbAccount => DbAccount.account_number,
    name: DbAccount => DbAccount.account_number,
  },
  CryptoWalletFinancialAccount: {
    __isTypeOf: DbAccount => DbAccount.type === 'CRYPTO_WALLET',
    ...commonFinancialAccountFields,
    number: DbAccount => DbAccount.account_number,
    name: DbAccount =>
      DbAccount.account_number.length >= 20
        ? DbAccount.account_number.slice(-8)
        : DbAccount.account_number,
  },
  ForeignSecuritiesFinancialAccount: {
    __isTypeOf: DbAccount => DbAccount.type === 'FOREIGN_SECURITIES',
    ...commonFinancialAccountFields,
    number: DbAccount => DbAccount.account_number,
    name: DbAccount => DbAccount.account_number,
  },
  ConversionTransaction: {
    ...commonTransactionFields,
  },
  CommonTransaction: {
    ...commonTransactionFields,
  },
  LtdFinancialEntity: {
    ...commonFinancialEntityFields,
  },
  PersonalFinancialEntity: {
    ...commonFinancialEntityFields,
  },
};
