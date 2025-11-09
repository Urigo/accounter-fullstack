import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { FinancialBankAccountsProvider } from '../providers/financial-bank-accounts.provider.js';
import type {
  FinancialAccountsModule,
  IGetFinancialAccountsByOwnerIdsResult,
  IGetFinancialBankAccountsByIdsResult,
} from '../types.js';
import { commonFinancialAccountFields } from './common.js';

async function getBankAccountByFinancialAccount(
  financialAccount: IGetFinancialAccountsByOwnerIdsResult,
  injector: Injector,
): Promise<IGetFinancialBankAccountsByIdsResult> {
  const bankAccount = await injector
    .get(FinancialBankAccountsProvider)
    .getFinancialBankAccountByIdLoader.load(financialAccount.id);
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
      getBankAccountByFinancialAccount(DbAccount, injector).then(bankAccount =>
        bankAccount.bank_number.toString(),
      ),
    branchNumber: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(bankAccount =>
        bankAccount.branch_number.toString(),
      ),
    name: async (DbAccount, _, { injector }) =>
      getBankAccountByFinancialAccount(DbAccount, injector).then(
        bankAccount => `${bankAccount.bank_number}-${DbAccount.account_number}`,
      ),
  },
};
