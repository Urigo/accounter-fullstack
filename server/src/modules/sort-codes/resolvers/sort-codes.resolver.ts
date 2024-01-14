import { GraphQLError } from 'graphql';
import { SortCodesProvider } from '../providers/sort-codes.provider.js';
import type { SortCodesModule } from '../types.js';
import { commonFinancialEntityFields } from './common.js';

export const sortCodesResolvers: SortCodesModule.Resolvers = {
  Query: {
    allSortCodes: async (_, __, { injector }) => {
      try {
        return await injector.get(SortCodesProvider).getAllSortCodes();
      } catch (e) {
        console.error('Error fetching sort codes', e);
        throw new GraphQLError((e as Error)?.message ?? 'Error fetching sort codes');
      }
    },
  },
  SortCode: {
    id: dbSortCode => dbSortCode.key,
    name: dbSortCode => dbSortCode.name,
  },
  NamedCounterparty: {
    sortCode: (parent, _, { injector }) =>
      parent
        ? injector
            .get(SortCodesProvider)
            .getSortCodesByFinancialEntitiesIdsLoader.load(parent)
            .then(sortCode => sortCode ?? null)
        : null,
  },
  LtdFinancialEntity: {
    ...commonFinancialEntityFields,
  },
  PersonalFinancialEntity: {
    ...commonFinancialEntityFields,
  },
  TaxCategory: {
    sortCode: (parent, _, { injector }) =>
      parent?.sort_code
        ? injector
            .get(SortCodesProvider)
            .getSortCodesByIdLoader.load(parent.sort_code)
            .then(sortCode => sortCode ?? null)
        : null,
  },
};
