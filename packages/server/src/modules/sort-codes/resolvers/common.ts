import { GraphQLError } from 'graphql';
import { SortCodesProvider } from '../providers/sort-codes.provider.js';
import type { SortCodesModule } from '../types.js';

export const commonFinancialEntityFields:
  | SortCodesModule.LtdFinancialEntityResolvers
  | SortCodesModule.PersonalFinancialEntityResolvers = {
  sortCode: (DbBusiness, _, { injector }) => {
    if (!DbBusiness.sort_code || !DbBusiness.owner_id) {
      return null;
    }
    try {
      return injector
        .get(SortCodesProvider)
        .getSortCodesByIdLoader.load({ key: DbBusiness.sort_code, ownerId: DbBusiness.owner_id })
        .then(sortCode => sortCode ?? null);
    } catch (e) {
      console.error(`Error finding sort code for business id ${DbBusiness.id}:`, e);
      throw new GraphQLError(`Error finding sort code for business id ${DbBusiness.id}`);
    }
  },
};
