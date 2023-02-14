import { Resolvers } from '../../../__generated__/types.mjs';
import { commonFinancialAccountFields } from './common.mjs';

export const financialAccountsResolvers: Resolvers = {
  BankFinancialAccount: {
    __isTypeOf: DbAccount => !!DbAccount.bank_number,
    ...commonFinancialAccountFields,
    accountNumber: DbAccount => DbAccount.account_number,
    bankNumber: DbAccount => DbAccount.bank_number?.toString() ?? '', // TODO: remove alternative ''
    branchNumber: DbAccount => DbAccount.branch_number?.toString() ?? '', // TODO: remove alternative ''
    routingNumber: () => '', // TODO: implement
    iban: () => '', // TODO: missing in DB
    swift: () => '', // TODO: missing in DB
    country: () => '', // TODO: missing in DB
    name: DbAccount => DbAccount.account_number,
  },
  CardFinancialAccount: {
    __isTypeOf: DbAccount => !DbAccount.bank_number,
    ...commonFinancialAccountFields,
    number: DbAccount => DbAccount.account_number,
    fourDigits: DbAccount => DbAccount.account_number,
  },
};
