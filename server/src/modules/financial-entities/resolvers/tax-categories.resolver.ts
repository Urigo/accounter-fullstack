import { GraphQLError } from 'graphql';
import { DEFAULT_FINANCIAL_ENTITY_ID } from '@shared/constants';
import { TaxCategoriesProvider } from '../providers/tax-categories.provider.js';
import type { FinancialEntitiesModule } from '../types';
import { commonTaxChargeFields } from './common.js';

export const taxCategoriesResolvers: FinancialEntitiesModule.Resolvers = {
  Query: {
    taxCategories: async (_parent, _args, { injector }) => {
      return injector
        .get(TaxCategoriesProvider)
        .getAllTaxCategories()
        .then(res => res.filter(c => !!c.name));
    },
    taxCategoryByBusinessId: async (_, args, { injector }) => {
      const { businessId, ownerId } = args;
      return injector
        .get(TaxCategoriesProvider)
        .taxCategoryByBusinessAndOwnerIDsLoader.load({ businessId, ownerId })
        .then(res => res ?? null);
    },
  },
  CommonCharge: commonTaxChargeFields,
  ConversionCharge: commonTaxChargeFields,
  SalaryCharge: commonTaxChargeFields,
  InternalTransferCharge: commonTaxChargeFields,
  DividendCharge: commonTaxChargeFields,
  LtdFinancialEntity: {
    taxCategory: async (parent, _, { injector }) => {
      const taxCategory = await injector
        .get(TaxCategoriesProvider)
        .taxCategoryByBusinessAndOwnerIDsLoader.load({
          businessId: parent.id,
          ownerId: DEFAULT_FINANCIAL_ENTITY_ID,
        });
      if (!taxCategory) {
        throw new GraphQLError(`Tax category for business ID="${parent.id}" not found`);
      }
      return taxCategory;
    },
  },
};
