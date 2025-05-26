import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IGetAllSortCodesQuery,
  IGetAllSortCodesResult,
  IGetSortCodesByIdsQuery,
  IInsertSortCodeParams,
  IInsertSortCodeQuery,
  IUpdateSortCodeParams,
  IUpdateSortCodeQuery,
} from '../types.js';

const getAllSortCodes = sql<IGetAllSortCodesQuery>`
  SELECT *
  FROM accounter_schema.sort_codes`;

const getSortCodesByIds = sql<IGetSortCodesByIdsQuery>`
  SELECT sc.*
  FROM accounter_schema.sort_codes sc
  WHERE ($isSortCodesIds = 0 OR sc.key IN $$sortCodesIds);`;

const insertSortCode = sql<IInsertSortCodeQuery>`
    INSERT INTO accounter_schema.sort_codes (name, key, default_irs_codes)
    VALUES ($name, $key, $defaultIrsCodes)
    RETURNING *;
  `;

const updateSortCode = sql<IUpdateSortCodeQuery>`
    UPDATE accounter_schema.sort_codes
    SET name = COALESCE(
      $name,
      name
    ),
    default_irs_codes = COALESCE(
      $defaultIrsCodes,
      default_irs_codes
    )
    WHERE key = $key
    RETURNING *;
  `;

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

  public addSortCode(params: IInsertSortCodeParams) {
    this.clearCache();
    return insertSortCode.run(params, this.dbProvider);
  }

  public async updateSortCode(params: IUpdateSortCodeParams) {
    this.clearCache();
    return updateSortCode.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
