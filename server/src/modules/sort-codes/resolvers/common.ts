import { GraphQLError } from 'graphql';
import { SortCodesProvider } from '@modules/sort-codes/providers/sort-codes.provider.js';
import type { SortCodesModule } from '../types.js';

export const commonFinancialEntityFields:
  | SortCodesModule.LtdFinancialEntityResolvers
  | SortCodesModule.PersonalFinancialEntityResolvers = {
  sortCode: (DbBusiness, _, { injector }) => {
    if (!DbBusiness.sort_code) {
      return null;
    }
    try {
      return injector
        .get(SortCodesProvider)
        .getSortCodesByIdLoader.load(DbBusiness.sort_code)
        .then(sortCode => sortCode ?? null);
    } catch (e) {
      console.error(`Error finding sort code for business id ${DbBusiness.id}:`, e);
      throw new GraphQLError(`Error finding sort code for business id ${DbBusiness.id}`);
    }
  },
};
