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
  },
  CommonCharge: commonTaxChargeFields,
  ConversionCharge: commonTaxChargeFields,
};
