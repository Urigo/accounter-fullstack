import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { errorSimplifier } from '../../../shared/errors.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { resolveReport1214Owner } from '../helpers/owner.helper.js';
import {
  assertReport1214Year,
  mapShareholderRow,
  normalizeShareholderInputs,
  type ShareholderRowInput,
} from '../helpers/shareholders.helper.js';
import { ShareholdersProvider } from '../providers/shareholders.provider.js';
import type { Report_1214Module } from '../types.js';

/**
 * Each linked business must be one of the owner's own financial entities: the `business_id`
 * foreign key alone would accept any business in the database. Rows are checked in order, so the
 * first bad row is the one reported.
 */
async function assertLinkedBusinessesBelongToOwner(
  injector: Injector,
  ownerId: string,
  rows: ReadonlyArray<ShareholderRowInput>,
): Promise<void> {
  const loader = injector.get(BusinessesProvider).getBusinessByIdLoader;
  const businesses = await Promise.all(
    rows.map(row => (row.businessId ? loader.load(row.businessId) : null)),
  );
  for (const [index, row] of rows.entries()) {
    if (row.businessId && businesses[index]?.owner_id !== ownerId) {
      throw new GraphQLError(
        `Shareholder row ${index + 1}: business ${row.businessId} was not found among the owner's businesses`,
        { extensions: { code: 'BAD_USER_INPUT' } },
      );
    }
  }
}

export const shareholdersResolvers: Report_1214Module.Resolvers = {
  Query: {
    shareholders: async (_, { ownerId: requestedOwnerId, year }, { injector }) => {
      try {
        assertReport1214Year(year);
        const ownerId = await resolveReport1214Owner(injector, requestedOwnerId, 'read');
        const rows = await injector
          .get(ShareholdersProvider)
          .getShareholdersByOwnerAndYearLoader.load({ ownerId, year });
        return rows.map(mapShareholderRow);
      } catch (error) {
        throw errorSimplifier(`Failed to get the shareholders of ${year}`, error);
      }
    },
  },
  Mutation: {
    setShareholders: async (_, { ownerId: requestedOwnerId, year, shareholders }, { injector }) => {
      try {
        assertReport1214Year(year);
        const rows = normalizeShareholderInputs(shareholders);
        const ownerId = await resolveReport1214Owner(injector, requestedOwnerId, 'write');
        await assertLinkedBusinessesBelongToOwner(injector, ownerId, rows);
        const saved = await injector
          .get(ShareholdersProvider)
          .replaceShareholders(ownerId, year, rows);
        return saved.map(mapShareholderRow);
      } catch (error) {
        throw errorSimplifier(`Failed to set the shareholders of ${year}`, error);
      }
    },
    copyShareholdersFromYear: async (
      _,
      { ownerId: requestedOwnerId, fromYear, toYear },
      { injector },
    ) => {
      try {
        assertReport1214Year(fromYear, 'fromYear');
        assertReport1214Year(toYear, 'toYear');
        if (fromYear === toYear) {
          throw new GraphQLError('fromYear and toYear must differ', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        const ownerId = await resolveReport1214Owner(injector, requestedOwnerId, 'write');
        const copied = await injector
          .get(ShareholdersProvider)
          .copyShareholders(ownerId, fromYear, toYear);
        return copied.map(mapShareholderRow);
      } catch (error) {
        throw errorSimplifier(`Failed to copy the shareholders of ${fromYear} to ${toYear}`, error);
      }
    },
  },
  Shareholder: {
    business: (shareholder, _, { injector }) =>
      shareholder.businessId
        ? injector
            .get(BusinessesProvider)
            .getBusinessByIdLoader.load(shareholder.businessId)
            // only a business in the owner's own books, as setShareholders enforces
            .then(business => (business?.owner_id === shareholder.ownerId ? business : null))
        : null,
  },
};
