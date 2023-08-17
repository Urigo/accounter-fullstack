import { TaxCategoriesProvider } from '../providers/tax-categories.provider.js';
import type { FinancialEntitiesModule } from '../types';

export const taxCategoriesResolvers: FinancialEntitiesModule.Resolvers = {
  Query: {
    taxCategories: async (_parent, _args, { injector }) => {
      return injector
        .get(TaxCategoriesProvider)
        .getAllTaxCategories()
        .then(res => res.filter(c => !!c.name));
    },
  },
  Charge: {
    taxCategory: async (DbCharge, _, { injector }) => {
      if (!DbCharge.tax_category_id) {
        return null;
      }
      return injector
        .get(TaxCategoriesProvider)
        .taxCategoryByIDsLoader.load(DbCharge.tax_category_id)
        .then(taxCategory => taxCategory ?? null);
    },
  },
};
