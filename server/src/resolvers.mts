import { pool } from './providers/db.mjs';
import { getFinancialEntitiesByIds } from './providers/sqlQueries.mjs';
import {
  BankFinancialAccountResolvers,
  CardFinancialAccountResolvers,
  LtdFinancialEntityResolvers,
  PersonalFinancialEntityResolvers,
  Resolvers,
} from './__generated__/types.mjs';

const commonFinancialEntityFields:
  | LtdFinancialEntityResolvers
  | PersonalFinancialEntityResolvers = {
  id: (DbBusiness) => DbBusiness.id,
  accounts: () => [], // TODO: implement
  charges: () => [], // TODO: implement
  linkedEntities: () => [], // TODO: implement
};

const commonFinancialAccountFields:
  | CardFinancialAccountResolvers
  | BankFinancialAccountResolvers = {
  id: (DbAccount) => DbAccount.account_number.toString(),
  charges: () => [], // TODO: implement
};

export const resolvers: Resolvers = {
  Query: {
    financialEntity: async (_, { id }) => {
      const dbFe = await getFinancialEntitiesByIds.run({ ids: [id] }, pool);
      return dbFe[0];
    },
  },
  LtdFinancialEntity: {
    __isTypeOf: () => true,
    ...commonFinancialEntityFields,
    govermentId: (DbBusiness) => DbBusiness.vat_number ?? '', // TODO: lots missing. should it stay mandatory?
    name: (DbBusiness) => DbBusiness.hebrew_name ?? DbBusiness.name,
    address: (DbBusiness) =>
      DbBusiness.address ?? DbBusiness.address_hebrew ?? '', // TODO: lots missing. should it stay mandatory?

    englishName: (DbBusiness) => DbBusiness.name ?? null,
    email: (DbBusiness) => DbBusiness.email,
    website: (DbBusiness) => DbBusiness.website,
    phoneNumber: (DbBusiness) => DbBusiness.phone_number,
  },
  PersonalFinancialEntity: {
    __isTypeOf: () => false,
    ...commonFinancialEntityFields,
    name: (DbBusiness) => DbBusiness.name,
    email: (DbBusiness) => DbBusiness.email ?? '', // TODO: remove alternative ''
    documents: () => [], // TODO: implement
  },
  BankFinancialAccount: {
    __isTypeOf: (DbAccount) => !!DbAccount.bank_number,
    ...commonFinancialAccountFields,
    accountNumber: (DbAccount) => DbAccount.account_number.toString(),
    bankNumber: (DbAccount) => DbAccount.bank_number?.toString() ?? '', // TODO: remove alternative ''
    branchNumber: (DbAccount) => DbAccount.branch_number?.toString() ?? '', // TODO: remove alternative ''
    routingNumber: () => '', // TODO: implement
    iban: () => '', // TODO: implement
    swift: () => '', // TODO: implement
    country: () => '', // TODO: implement
    name: (DbAccount) => DbAccount.account_number.toString(),
  },
  CardFinancialAccount: {
    __isTypeOf: (DbAccount) => !DbAccount.bank_number,
    ...commonFinancialAccountFields,
    number: (DbAccount) => DbAccount.account_number.toString(),
    fourDigits: (DbAccount) => DbAccount.account_number.toString(),
  },
};
