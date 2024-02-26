import { Resolvers } from '@shared/gql-types';
import { hasFinancialEntitiesCoreProperties } from '../helpers/financial-entities.helper.js';
import { BusinessesProvider } from '../providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../providers/tax-categories.provider.js';
import type { FinancialEntitiesModule, IUpdateTaxCategoryParams } from '../types.js';
import { commonDocumentsFields, commonTransactionFields, ledgerCounterparty } from './common.js';

export const financialEntitiesResolvers: FinancialEntitiesModule.Resolvers &
  Pick<Resolvers, 'FinancialEntity'> = {
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
    updateTaxCategory: async (_, { taxCategoryId, fields }, { injector }) => {
      if (hasFinancialEntitiesCoreProperties(fields)) {
        await injector
          .get(FinancialEntitiesProvider)
          .updateFinancialEntity({ ...fields, financialEntityId: taxCategoryId });
      }
      const adjustedFields: IUpdateTaxCategoryParams = {
        hashavshevetName: fields.hashavshevetName,
        taxCategoryId,
      };
      try {
        if (fields.hashavshevetName) {
          await injector
            .get(TaxCategoriesProvider)
            .updateTaxCategory(adjustedFields)
            .catch((e: Error) => {
              console.error(e);
              throw new Error(`Update core tax category fields error`);
            });
        }

        const updatedTaxCategory = await injector
          .get(TaxCategoriesProvider)
          .taxCategoryByIDsLoader.load(taxCategoryId);
        if (!updatedTaxCategory) {
          throw new Error(`Updated tax category not found`);
        }
        return updatedTaxCategory;
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: `Failed to update tax category ID="${taxCategoryId}": ${(e as Error).message}`,
        };
      }
    },
  },
  FinancialEntity: {
    __resolveType: async (parent, { injector }) => {
      if (!parent) {
        return null;
      }
      switch (parent.type) {
        case 'business': {
          if (!('country' in parent)) {
            const business = await injector
              .get(BusinessesProvider)
              .getBusinessByIdLoader.load(parent.id);
            if (business) {
              Object.assign(parent, business);
            }
          }
          return 'LtdFinancialEntity';
        }
        case 'tax_category':
          if (!('hashavshevet_name' in parent)) {
            const texCategory = await injector
              .get(TaxCategoriesProvider)
              .taxCategoryByIDsLoader.load(parent.id);
            if (texCategory) {
              Object.assign(parent, texCategory);
            }
          }
          return 'TaxCategory';
      }
      throw new Error(`Unknown financial entity type: ${parent}`);
    },
  },
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
