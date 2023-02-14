import { GraphQLError } from 'graphql';
import { pool } from '../../../providers/db.js';
import {
  getAccountCardsByKeysLoader,
  getAccountCardsBySortCodesLoader,
} from '../../../providers/hash-account-cards.js';
import { getSortCodesByIdLoader, getSortCodesByIds } from '../../../providers/hash-sort-codes.js';
import { HashavshevetModule } from '../__generated__/types.js';
import { commonTransactionFields } from './common.js';

export const hashavshevetResolvers: HashavshevetModule.Resolvers = {
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
  // WireTransaction: {
  //   ...commonTransactionFields,
  // },
  // FeeTransaction: {
  //   ...commonTransactionFields,
  // },
  // ConversionTransaction: {
  //   ...commonTransactionFields,
  // },
  CommonTransaction: {
    ...commonTransactionFields,
  },
  BusinessTransactionSum: {
    sortCode: rawSum =>
      getAccountCardsByKeysLoader.load(rawSum.businessName).then(async card => {
        if (!card) {
          throw new GraphQLError(
            `Hashavshevet account card not found for business "${rawSum.businessName}"`,
          );
        }
        return await getSortCodesByIdLoader.load(card.sort_code).then(sortCode => {
          if (!sortCode) {
            throw new GraphQLError(
              `Hashavshevet sort code not found for account card "${card.key}"`,
            );
          }
          return sortCode;
        });
      }),
  },
  LedgerRecord: {
    hashavshevetId: DbLedgerRecord => DbLedgerRecord.hashavshevet_id,
  },
};
