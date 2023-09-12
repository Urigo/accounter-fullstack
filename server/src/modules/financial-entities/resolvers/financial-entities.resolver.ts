// import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import type { FinancialEntitiesModule } from '../types.js';
import {
  commonChargeFields,
  commonDocumentsFields,
  commonFinancialEntityFields,
  commonTransactionFields,
  ledgerCounterparty,
} from './common.js';

export const financialEntitiesResolvers: FinancialEntitiesModule.Resolvers = {
  Query: {
    financialEntity: async (_, { id }, { injector }) => {
      const dbFe = await injector
        .get(FinancialEntitiesProvider)
        .getFinancialEntityByIdLoader.load(id);
      if (!dbFe) {
        throw new Error(`Financial entity ID="${id}" not found`);
      }
      return dbFe;
    },
    allFinancialEntities: async (_, __, { injector }) => {
      return injector.get(FinancialEntitiesProvider).getAllFinancialEntities();
    },
  },
  LtdFinancialEntity: {
    __isTypeOf: () => true,
    ...commonFinancialEntityFields,
    governmentId: DbBusiness => DbBusiness.vat_number ?? '', // TODO: lots missing. should it stay mandatory?
    name: DbBusiness => DbBusiness.name,
    address: DbBusiness => DbBusiness.address ?? DbBusiness.address_hebrew ?? '', // TODO: lots missing. should it stay mandatory?

    englishName: DbBusiness => DbBusiness.name,
    email: DbBusiness => DbBusiness.email,
    website: DbBusiness => DbBusiness.website,
    phoneNumber: DbBusiness => DbBusiness.phone_number,
  },
  PersonalFinancialEntity: {
    __isTypeOf: () => false,
    ...commonFinancialEntityFields,
    name: DbBusiness => DbBusiness.name,
    email: DbBusiness => DbBusiness.email ?? '', // TODO: remove alternative ''
  },
  BeneficiaryCounterparty: {
    // TODO: improve counterparty handle
    __isTypeOf: () => true,
    counterparty: parent => parent.counterpartyID,
    percentage: parent => parent.percentage,
  },
  CommonCharge: commonChargeFields,
  ConversionCharge: commonChargeFields,
  WireTransaction: {
    ...commonTransactionFields,
  },
  FeeTransaction: {
    ...commonTransactionFields,
  },
  ConversionTransaction: {
    ...commonTransactionFields,
  },
  CommonTransaction: {
    ...commonTransactionFields,
  },
  Invoice: {
    ...commonDocumentsFields,
  },
  InvoiceReceipt: {
    ...commonDocumentsFields,
  },
  Proforma: {
    ...commonDocumentsFields,
  },
  Unprocessed: {
    ...commonDocumentsFields,
  },
  Receipt: {
    ...commonDocumentsFields,
  },
  LedgerRecord: {
    creditAccount1: ledgerCounterparty('CreditAccount1'),
    creditAccount2: ledgerCounterparty('CreditAccount2'),
    debitAccount1: ledgerCounterparty('DebitAccount1'),
    debitAccount2: ledgerCounterparty('DebitAccount2'),
  },
};
