import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllSortCodesQuery,
  IGetSortCodesByBusinessIdsQuery,
  IGetSortCodesByIdsQuery,
} from '../types.js';

const getAllSortCodes = sql<IGetAllSortCodesQuery>`
  SELECT *
  FROM accounter_schema.hash_sort_codes`;

const getSortCodesByIds = sql<IGetSortCodesByIdsQuery>`
  SELECT sc.*
  FROM accounter_schema.hash_sort_codes sc
  WHERE ($isSortCodesIds = 0 OR sc.key IN $$sortCodesIds);`;

const getSortCodesByBusinessIds = sql<IGetSortCodesByBusinessIdsQuery>`
  SELECT b.id as business_id, sc.*
  FROM accounter_schema.businesses b
  LEFT JOIN accounter_schema.hash_sort_codes sc
    ON b.sort_code = sc.key
  WHERE sc.key IS NOT null
    AND ($isBusinessIDs = 0 OR b.id IN $$businessIDs);`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class SortCodesProvider {
  constructor(private dbProvider: DBProvider) {}

  public getAllSortCodes() {
    return getAllSortCodes.run(undefined, this.dbProvider);
  }

  private async batchSortCodesByIds(sortCodesIds: readonly number[]) {
    const ledgerRecords = await getSortCodesByIds.run(
      {
        isSortCodesIds: sortCodesIds.length > 0 ? 1 : 0,
        sortCodesIds,
      },
      this.dbProvider,
    );
    return sortCodesIds.map(id => ledgerRecords.find(record => record.key === id));
  }

  public getSortCodesByIdLoader = new DataLoader(
    (keys: readonly number[]) => this.batchSortCodesByIds(keys),
    {
      cache: false,
    },
  );

  private async batchSortCodesByBusinessIds(businessIDs: readonly string[]) {
    console.log('dbprovider', !!this.dbProvider);
    try {
      const sortCodes = await getSortCodesByBusinessIds.run(
        {
          isBusinessIDs: businessIDs.length > 0 ? 1 : 0,
          businessIDs,
        },
        this.dbProvider,
      );
      return businessIDs.map(id => sortCodes.find(sortCode => sortCode.business_id === id));
    } catch (e) {
      throw new GraphQLError('Error fetching sort codes');
    }
  }

  public getSortCodesByBusinessIdsLoader = new DataLoader(
    (ids: readonly string[]) => this.batchSortCodesByBusinessIds(ids),
    {
      cache: false,
    },
  );
}
