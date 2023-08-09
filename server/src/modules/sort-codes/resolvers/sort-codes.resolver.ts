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
  BusinessTransactionSum: {
    sortCode: (rawSum, _, { injector }, __) =>
      injector
        .get(SortCodesProvider)
        .getSortCodesByBusinessIdsLoader.load(rawSum.businessID).then(sortCode => sortCode ?? null)
  },
  NamedCounterparty: {
    sortCode: (parent, _, { injector }) =>
      injector
        .get(SortCodesProvider)
        .getSortCodesByBusinessIdsLoader.load(
          typeof parent === 'string'
            ? parent
            : (parent as unknown as { counterpartyID: string })!.counterpartyID,
        ).then(sortCode => sortCode ?? null)
  },
  LtdFinancialEntity: {
    ...commonFinancialEntityFields,
  },
  PersonalFinancialEntity: {
    ...commonFinancialEntityFields,
  },
};
