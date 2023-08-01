import type { ResolverTypeWrapper, TaxCategory } from '@shared/gql-types';
import { TaxCategoriesProvider } from '../providers/tax-categories.provider';
import type { FinancialEntitiesModule } from '../types';

export const taxCategoriesResolvers: FinancialEntitiesModule.Resolvers = {
  Query: {
    taxCategories: async (_parent, _args, { injector }) => {
      return injector
        .get(TaxCategoriesProvider)
        .getAllTaxCategories()
        .then(res => res.filter(c => !!c.name) as ResolverTypeWrapper<TaxCategory>[]);
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
        .then(taxCategory =>
          taxCategory ? ({ ...taxCategory, __typename: 'TaxCategory' } as TaxCategory) : null,
        );
    },
  },
};
