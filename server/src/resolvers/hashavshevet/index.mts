import { Resolvers } from '../../__generated__/types.mjs';
import { pool } from '../../providers/db.mjs';
import { getAccountCardsBySortCodesLoader } from '../../providers/hash-account-cards.mjs';
import { getSortCodesByIdLoader, getSortCodesByIds } from '../../providers/hash-sort-codes.mjs';
import { GraphQLError } from 'graphql';

export const hashavshevetResolvers: Resolvers = {
  Query: {
    allSortCodes: async () => {
      try {
        return await getSortCodesByIds.run(
          {
            isSortCodesIds: 0,
            sortCodesIds: [null],
          },
          pool,
        );
      } catch (e) {
        console.error('Error fetching sort codes', e);
        throw new GraphQLError((e as Error)?.message ?? 'Error fetching sort codes');
      }
    },
  },
  SortCode: {
    id: dbSortCode => dbSortCode.key,
    name: dbSortCode => dbSortCode.name,
    accounts: async dbSortCode => {
      if (!dbSortCode.key) {
        return [];
      }
      try {
        return getAccountCardsBySortCodesLoader.load(dbSortCode.key);
      } catch (e) {
        console.log(`Error fetching accounts for sort code ${dbSortCode.key}:`, e);
        return [];
      }
    },
  },
  HashavshevetAccount: {
    id: dbHashAccount => dbHashAccount.id,
    key: dbHashAccount => dbHashAccount.key,
    sortCode: dbHashAccount => {
      try {
        return getSortCodesByIdLoader.load(dbHashAccount.sort_code).then(sortCode => {
          if (!sortCode) {
            throw new Error('Sort code not found');
          }
          return sortCode;
        });
      } catch (e) {
        console.error(`Error sort code for Hashavshevet account card ${dbHashAccount.key}:`, e);
        throw new GraphQLError(
          `Error sort code for Hashavshevet account card ${dbHashAccount.key}: ${e}`,
        );
      }
    },
    name: dbHashAccount => dbHashAccount.name,
  },
};
