// import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../providers/tax-categories.provider.js';
import type {
  FinancialEntitiesModule,
  IUpdateBusinessParams,
  IUpdateBusinessTaxCategoryParams,
} from '../types.js';
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
    allFinancialEntities: async (_, { page, limit }, { injector }) => {
      const financialEntities = await injector
        .get(FinancialEntitiesProvider)
        .getAllFinancialEntities();

      page ??= 1;
      let pageFinancialEntities = financialEntities.sort((a, b) =>
        a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1,
      );

      // handle pagination
      if (limit) {
        pageFinancialEntities = financialEntities.slice(page * limit - limit, page * limit);
      }

      return {
        __typename: 'PaginatedFinancialEntities',
        nodes: pageFinancialEntities,
        pageInfo: {
          totalPages: limit ? Math.ceil(financialEntities.length / limit) : 1,
          currentPage: page + 1,
          pageSize: limit,
        },
      };
    },
  },
  Mutation: {
    updateBusiness: async (_, { businessId, ownerId, fields }, { injector }) => {
      const adjustedFields: IUpdateBusinessParams = {
        address: fields.address,
        email: fields.email,
        vatNumber: fields.governmentId,
        hebrewName: fields.hebrewName,
        name: fields.name,
        phoneNumber: fields.phoneNumber,
        sortCode: fields.sortCode,
        website: fields.website,
        businessId,
      };
      try {
        if (
          fields.name ||
          fields.hebrewName ||
          fields.address ||
          fields.email ||
          fields.governmentId ||
          fields.phoneNumber ||
          fields.website ||
          fields.sortCode
        ) {
          await injector
            .get(FinancialEntitiesProvider)
            .updateBusiness(adjustedFields)
            .catch((e: Error) => {
              console.error(e);
              throw new Error(`Update core business fields error`);
            });
        }

        if (fields.taxCategory) {
          const texCategoryParams: IUpdateBusinessTaxCategoryParams = {
            businessId,
            ownerId,
            taxCategoryId: fields.taxCategory,
          };
          try {
            await injector.get(TaxCategoriesProvider).insertBusinessTaxCategory(texCategoryParams);
          } catch (error) {
            await injector
              .get(TaxCategoriesProvider)
              .updateBusinessTaxCategory(texCategoryParams)
              .catch((e: Error) => {
                console.error(e);
                throw new Error(`Update tax category error`);
              });
          }
        }

        const updatedBusiness = await injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(businessId);
        if (!updatedBusiness) {
          throw new Error(`Updated business not found`);
        }
        return updatedBusiness;
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: `Failed to update business ID="${businessId}": ${(e as Error).message}`,
        };
      }
    },
  },
  LtdFinancialEntity: {
    __isTypeOf: () => true,
    ...commonFinancialEntityFields,
    governmentId: DbBusiness => DbBusiness.vat_number ?? '', // TODO: lots missing. should it stay mandatory?
    name: DbBusiness => DbBusiness.name,
    address: DbBusiness => DbBusiness.address ?? DbBusiness.address_hebrew ?? '', // TODO: lots missing. should it stay mandatory?

    hebrewName: DbBusiness => DbBusiness.hebrew_name,
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
  SalaryCharge: commonChargeFields,
  InternalTransferCharge: commonChargeFields,
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
  CreditInvoice: {
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
