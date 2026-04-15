import { GraphQLError } from 'graphql';
import { Currency } from '../../../shared/enums.js';
import { errorSimplifier } from '../../../shared/errors.js';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { FinancialAccountsProvider } from '../../financial-accounts/providers/financial-accounts.provider.js';
import { BankDepositsProvider } from '../providers/bank-deposits.provider.js';
import type { BankDepositsModule } from '../types.js';

export const bankDepositsResolvers: BankDepositsModule.Resolvers = {
  Query: {
    deposit: async (_, { id }, { injector }) => {
      try {
        const depositRecord = await injector
          .get(BankDepositsProvider)
          .bankDepositByIdLoader.load(id);

        if (!depositRecord) {
          throw new GraphQLError('Deposit not found');
        }

        return depositRecord;
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        throw new GraphQLError('Error fetching bank deposit');
      }
    },
    allDeposits: async (_, __, { injector }) => {
      try {
        return injector.get(BankDepositsProvider).getAllBankDeposits();
      } catch (e) {
        throw errorSimplifier('Error fetching all deposits', e);
      }
    },
  },
  Mutation: {
    createDeposit: async (_, { currency, name, openDate }, { injector }) => {
      try {
        const deposit = await injector.get(BankDepositsProvider).insertBankDeposit({
          name,
          currency,
          openDate: openDate ? new Date(openDate) : null,
        });

        return deposit;
      } catch (e) {
        throw errorSimplifier('Error creating deposit', e);
      }
    },
  },
  BankDeposit: {
    id: deposit => deposit.id,
    name: deposit => deposit.name,
    currency: async (deposit, _, { injector }) => {
      try {
        const { defaultLocalCurrency } = await injector
          .get(AdminContextProvider)
          .getVerifiedAdminContext();
        return (deposit.currency as Currency) ?? defaultLocalCurrency;
      } catch (e) {
        throw errorSimplifier(`Error fetching deposit currency for deposit ${deposit.name}`, e);
      }
    },
    account: async (deposit, _, { injector }) => {
      if (!deposit.account_id) {
        return null;
      }
      try {
        return injector
          .get(FinancialAccountsProvider)
          .getFinancialAccountByAccountIDLoader.load(deposit.account_id)
          .then(account => {
            if (!account) {
              throw new GraphQLError(`Financial account not found for deposit ${deposit.name}`);
            }
            return account;
          });
      } catch (e) {
        throw errorSimplifier(`Error fetching deposit account for deposit ${deposit.name}`, e);
      }
    },
    openDate: deposit => (deposit.open_date ? dateToTimelessDateString(deposit.open_date) : null),
    closeDate: deposit =>
      deposit.close_date ? dateToTimelessDateString(deposit.close_date) : null,
    isOpen: deposit => !deposit.close_date,
  },
};
