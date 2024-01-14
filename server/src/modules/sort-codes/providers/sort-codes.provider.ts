import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllSortCodesQuery,
  IGetSortCodesByFinancialEntitiesIdsQuery,
  IGetSortCodesByIdsQuery,
} from '../types.js';

const getAllSortCodes = sql<IGetAllSortCodesQuery>`
  SELECT *
  FROM accounter_schema.hash_sort_codes`;

const getSortCodesByIds = sql<IGetSortCodesByIdsQuery>`
  SELECT sc.*
  FROM accounter_schema.hash_sort_codes sc
  WHERE ($isSortCodesIds = 0 OR sc.key IN $$sortCodesIds);`;

const getSortCodesByFinancialEntitiesIds = sql<IGetSortCodesByFinancialEntitiesIdsQuery>`
  SELECT fe.id as financial_entity_id, sc.*
  FROM accounter_schema.financial_entities fe
  LEFT JOIN accounter_schema.hash_sort_codes sc
    ON fe.sort_code = sc.key
  WHERE sc.key IS NOT null
    AND ($isFinancialEntitiesIDs = 0 OR fe.id IN $$financialEntitiesIDs);`;

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

  private async batchSortCodesByFinancialEntitiesIds(financialEntitiesIDs: readonly string[]) {
    try {
      const sortCodes = await getSortCodesByFinancialEntitiesIds.run(
        {
          isFinancialEntitiesIDs: financialEntitiesIDs.length > 0 ? 1 : 0,
          financialEntitiesIDs,
        },
        this.dbProvider,
      );
      return financialEntitiesIDs.map(id =>
        sortCodes.find(sortCode => sortCode.financial_entity_id === id),
      );
    } catch (e) {
      throw new GraphQLError('Error fetching sort codes');
    }
  }

  public getSortCodesByFinancialEntitiesIdsLoader = new DataLoader(
    (ids: readonly string[]) => this.batchSortCodesByFinancialEntitiesIds(ids),
    {
      cache: false,
    },
  );
}
