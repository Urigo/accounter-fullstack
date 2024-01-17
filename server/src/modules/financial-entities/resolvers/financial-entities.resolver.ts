import { GraphQLError } from 'graphql';
import { Resolvers } from '@shared/gql-types';
import { BusinessesProvider } from '../providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../providers/tax-categories.provider.js';
import type { FinancialEntitiesModule, IGetFinancialEntitiesByIdsResult } from '../types.js';
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
  FinancialEntity: {
    __resolveType: async (parent, { injector }) => {
      if (!parent) {
        return null;
      }
      let financialEntity: IGetFinancialEntitiesByIdsResult | undefined = undefined;
      if (typeof parent === 'string') {
        financialEntity = await injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(parent);
        if (!financialEntity) {
          throw new Error(`Financial entity ID="${parent}" not found`);
        }
        parent = financialEntity;
      }
      financialEntity ??= parent as IGetFinancialEntitiesByIdsResult;
      switch (financialEntity.type) {
        case 'business': {
          if (!('country' in financialEntity)) {
            const business = await injector
              .get(BusinessesProvider)
              .getBusinessByIdLoader.load(financialEntity.id);
            if (business) {
              Object.assign(parent, business);
            }
          }
          return 'LtdFinancialEntity';
        }
        case 'tax_category':
          if (!('hashavshevet_name' in financialEntity)) {
            const texCategory = await injector
              .get(TaxCategoriesProvider)
              .taxCategoryByIDsLoader.load(financialEntity.id);
            if (texCategory) {
              Object.assign(parent, texCategory);
            }
          }
          return 'TaxCategory';
      }
      return 'NamedCounterparty';
    },
  },
  BeneficiaryCounterparty: {
    // TODO: improve counterparty handle
    __isTypeOf: () => true,
    counterparty: (parent, _, { injector }) =>
      injector
        .get(FinancialEntitiesProvider)
        .getFinancialEntityByIdLoader.load(parent.counterpartyID)
        .then(res => {
          if (!res) {
            throw new GraphQLError(`Financial entity ID="${parent.counterpartyID}" not found`);
          }
          return res;
        }),
    percentage: parent => parent.percentage,
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
