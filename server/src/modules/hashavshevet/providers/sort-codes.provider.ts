import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import pgQuery from '@pgtyped/query';
import type { IGetSortCodesByIdsParams, IGetSortCodesByIdsQuery } from '../types.js';

const { sql } = pgQuery;

const getSortCodesByIds = sql<IGetSortCodesByIdsQuery>`
    SELECT sc.*
    FROM accounter_schema.hash_sort_codes sc
    WHERE ($isSortCodesIds = 0 OR sc.key IN $$sortCodesIds);`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class SortCodesProvider {
  constructor(private dbProvider: DBProvider) {}

  public getSortCodesByIds(params: IGetSortCodesByIdsParams) {
    return getSortCodesByIds.run(params, this.dbProvider);
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
}
