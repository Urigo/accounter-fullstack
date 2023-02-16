import { GraphQLError } from 'graphql';
import { AccountCardsProvider } from '../providers/account-cards.provider.js';
import { SortCodesProvider } from '../providers/sort-codes.provider.js';
import type { HashavshevetModule } from '../types.js';
import { commonTransactionFields } from './common.js';

export const hashavshevetResolvers: HashavshevetModule.Resolvers = {
  Query: {
    allSortCodes: async (_, __, { injector }) => {
      try {
        return await injector.get(SortCodesProvider).getSortCodesByIds({
          isSortCodesIds: 0,
          sortCodesIds: [null],
        });
      } catch (e) {
        console.error('Error fetching sort codes', e);
        throw new GraphQLError((e as Error)?.message ?? 'Error fetching sort codes');
      }
    },
  },
  SortCode: {
    id: dbSortCode => dbSortCode.key,
    name: dbSortCode => dbSortCode.name,
    accounts: async (dbSortCode, _, { injector }) => {
      if (!dbSortCode.key) {
        return [];
      }
      try {
        return injector
          .get(AccountCardsProvider)
          .getAccountCardsBySortCodesLoader.load(dbSortCode.key);
      } catch (e) {
        console.log(`Error fetching accounts for sort code ${dbSortCode.key}:`, e);
        return [];
      }
    },
  },
  HashavshevetAccount: {
    id: dbHashAccount => dbHashAccount.id,
    key: dbHashAccount => dbHashAccount.key,
    sortCode: (dbHashAccount, _, { injector }) => {
      try {
        return injector
          .get(SortCodesProvider)
          .getSortCodesByIdLoader.load(dbHashAccount.sort_code)
          .then(sortCode => {
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
    sortCode: (rawSum, _, { injector }) =>
      injector
        .get(AccountCardsProvider)
        .getAccountCardsByKeysLoader.load(rawSum.businessName)
        .then(async card => {
          if (!card) {
            throw new GraphQLError(
              `Hashavshevet account card not found for business "${rawSum.businessName}"`,
            );
          }
          return await injector
            .get(SortCodesProvider)
            .getSortCodesByIdLoader.load(card.sort_code)
            .then(sortCode => {
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
