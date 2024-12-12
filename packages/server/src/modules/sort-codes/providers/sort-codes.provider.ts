import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IGetAllSortCodesQuery,
  IGetAllSortCodesResult,
  IGetSortCodesByIdsQuery,
} from '../types.js';

const getAllSortCodes = sql<IGetAllSortCodesQuery>`
  SELECT *
  FROM accounter_schema.sort_codes`;

const getSortCodesByIds = sql<IGetSortCodesByIdsQuery>`
  SELECT sc.*
  FROM accounter_schema.sort_codes sc
  WHERE ($isSortCodesIds = 0 OR sc.key IN $$sortCodesIds);`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class SortCodesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  public getAllSortCodes() {
    const data = this.cache.get<IGetAllSortCodesResult[]>('all-sort-codes');
    if (data) {
      return Promise.resolve(data);
    }
    return getAllSortCodes.run(undefined, this.dbProvider).then(data => {
      this.cache.set('all-sort-codes', data);
      data.map(sortCode => {
        this.cache.set(`sortcode-${sortCode.key}`, sortCode);
      });
      return data;
    });
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
      cacheKeyFn: key => `sortcode-${key}`,
      cacheMap: this.cache,
    },
  );

  public clearCache() {
    this.cache.clear();
  }
}
