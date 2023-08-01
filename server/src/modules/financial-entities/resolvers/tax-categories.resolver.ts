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
};
