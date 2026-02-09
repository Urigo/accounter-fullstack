import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../app-providers/db.provider.js';
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
    INSERT INTO accounter_schema.sort_codes (name, key, default_irs_code)
    VALUES ($name, $key, $defaultIrsCode)
    RETURNING *;
  `;

const updateSortCode = sql<IUpdateSortCodeQuery>`
    UPDATE accounter_schema.sort_codes
    SET name = COALESCE(
      $name,
      name
    ),
    default_irs_code = COALESCE(
      $defaultIrsCode,
      default_irs_code
    )
    WHERE key = $key
    RETURNING *;
  `;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class SortCodesProvider {
  constructor(private dbProvider: DBProvider) {}

  private allSortCodesCache: Promise<IGetAllSortCodesResult[]> | null = null;
  public getAllSortCodes() {
    if (this.allSortCodesCache) {
      return this.allSortCodesCache;
    }
    this.allSortCodesCache = getAllSortCodes.run(undefined, this.dbProvider).then(data => {
      data.map(sortCode => {
        this.getSortCodesByIdLoader.prime(sortCode.key, sortCode);
      });
      return data;
    });
    return this.allSortCodesCache;
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

  public getSortCodesByIdLoader = new DataLoader((keys: readonly number[]) =>
    this.batchSortCodesByIds(keys),
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
    this.getSortCodesByIdLoader.clearAll();
    this.allSortCodesCache = null;
  }
}
