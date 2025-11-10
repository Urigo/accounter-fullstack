import { GraphQLError } from 'graphql';
import { FinancialAccountsProvider } from '../providers/financial-accounts.provider.js';
import type {
  FinancialAccountsModule,
  IInsertFinancialAccountsParams,
  IUpdateFinancialAccountParams,
} from '../types.js';
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
    financialAccountsByOwner: async (_, { ownerId }, { injector }) => {
      return injector
        .get(FinancialAccountsProvider)
        .getFinancialAccountsByOwnerIdLoader.load(ownerId);
    },
    financialAccount: async (_, { id }, { injector }) => {
      return injector
        .get(FinancialAccountsProvider)
        .getFinancialAccountByAccountIDLoader.load(id)
        .then(account => {
          if (!account) {
            throw new GraphQLError('Financial account not found');
          }
          return account;
        });
    },
  },
  Mutation: {
    deleteFinancialAccount: async (_, { id }, { injector }) => {
      return injector
        .get(FinancialAccountsProvider)
        .deleteFinancialAccount({ financialAccountId: id })
        .then(() => true);
    },
    createFinancialAccount: async (_, { input }, { injector }) => {
      try {
        const bankAccount: IInsertFinancialAccountsParams['bankAccounts'][number] = {
          accountNumber: input.number,
          name: input.name,
          privateBusiness: input.privateOrBusiness,
          ownerId: input.ownerId,
          type: input.type,
        };
        const [account] = await injector
          .get(FinancialAccountsProvider)
          .insertFinancialAccounts({ bankAccounts: [bankAccount] });

        if (input.bankAccountDetails) {
          // TODO: Update bank account details
        }

        return account;
      } catch (error) {
        const message = 'Failed to create financial account';
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
    updateFinancialAccount: async (_, { id, fields }, { injector }) => {
      try {
        const updatedAccount: IUpdateFinancialAccountParams = {
          financialAccountId: id,
          accountNumber: fields.number,
          ownerId: fields.ownerId,
          privateBusiness: fields.privateOrBusiness,
          type: fields.type,
        };
        const account = await injector
          .get(FinancialAccountsProvider)
          .updateFinancialAccount(updatedAccount);

        if (fields.bankAccountDetails) {
          // TODO: Update bank account details
        }

        return account;
      } catch (error) {
        const message = 'Failed to update financial account';
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
  },
  CardFinancialAccount: {
    __isTypeOf: DbAccount => DbAccount.type === 'CREDIT_CARD',
    ...commonFinancialAccountFields,
    fourDigits: DbAccount => DbAccount.account_number,
    name: DbAccount => DbAccount.account_name ?? DbAccount.account_number,
  },
  CryptoWalletFinancialAccount: {
    __isTypeOf: DbAccount => DbAccount.type === 'CRYPTO_WALLET',
    ...commonFinancialAccountFields,
    name: DbAccount =>
      DbAccount.account_name ??
      (DbAccount.account_number.length >= 20
        ? DbAccount.account_number.slice(-8)
        : DbAccount.account_number),
  },
  ForeignSecuritiesFinancialAccount: {
    __isTypeOf: DbAccount => DbAccount.type === 'FOREIGN_SECURITIES',
    ...commonFinancialAccountFields,
    name: DbAccount => DbAccount.account_name ?? DbAccount.account_number,
  },
  BankDepositFinancialAccount: {
    __isTypeOf: DbAccount => DbAccount.type === 'BANK_DEPOSIT_ACCOUNT',
    ...commonFinancialAccountFields,
    name: DbAccount => DbAccount.account_name ?? DbAccount.account_number,
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
