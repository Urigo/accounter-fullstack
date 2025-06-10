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
    sortCode: async (_, { key }, { injector }) => {
      try {
        return await injector
          .get(SortCodesProvider)
          .getSortCodesByIdLoader.load(key)
          .then(sortCode => sortCode ?? null);
      } catch (e) {
        console.error(`Error fetching sort code ${key}`, e);
        throw new GraphQLError((e as Error)?.message ?? `Error fetching sort code ${key}`);
      }
    },
  },

  Mutation: {
    addSortCode: (_, { key, name, defaultIrsCode }, { injector }) => {
      return injector
        .get(SortCodesProvider)
        .addSortCode({
          key,
          name,
          defaultIrsCode: defaultIrsCode ?? undefined,
        })
        .catch(e => {
          console.error(
            `Error adding sort code: key=${key}, name=${name}`,
            JSON.stringify(e, null, 2),
          );
          throw new GraphQLError(`Error adding sort code "${name}"`);
        })
        .then(() => true);
    },
    updateSortCode: (_, { key, fields }, { injector }) => {
      return injector
        .get(SortCodesProvider)
        .updateSortCode({
          key,
          ...fields,
        })
        .catch(e => {
          console.error(`Error updating sort code: key=${key}`, JSON.stringify(e, null, 2));
          throw new GraphQLError(`Error updating sort code ${key}`);
        })
        .then(() => true);
    },
  },
  SortCode: {
    id: dbSortCode => dbSortCode.key.toString(),
    key: dbSortCode => dbSortCode.key,
    name: dbSortCode => dbSortCode.name,
    defaultIrsCode: dbSortCode => dbSortCode.default_irs_code,
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
