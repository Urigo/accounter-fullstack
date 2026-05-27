import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { reassureOwnerIdExists } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IGetAllSortCodesQuery,
  IGetAllSortCodesResult,
  IGetSortCodesByIdsQuery,
  IGetSortCodesByOwnerIdsQuery,
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

const getSortCodesByOwnerIds = sql<IGetSortCodesByOwnerIdsQuery>`
  SELECT sc.*
  FROM accounter_schema.sort_codes sc
  WHERE sc.owner_id IN $$ownerIds;`;

const insertSortCode = sql<IInsertSortCodeQuery>`
    INSERT INTO accounter_schema.sort_codes (name, key, default_irs_code, owner_id)
    VALUES ($name, $key, $defaultIrsCode, $ownerId)
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
    WHERE key = $key AND owner_id = $ownerId
    RETURNING *;
  `;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class SortCodesProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
  ) {}

  private allSortCodesCache: Promise<IGetAllSortCodesResult[]> | null = null;
  public getAllSortCodes() {
    if (this.allSortCodesCache) {
      return this.allSortCodesCache;
    }
    this.allSortCodesCache = getAllSortCodes.run(undefined, this.db).then(data => {
      data.map(sortCode => {
        this.getSortCodesByIdLoader.prime(
          { key: sortCode.key, ownerId: sortCode.owner_id },
          sortCode,
        );
      });
      return data;
    });
    return this.allSortCodesCache;
  }

  private async batchSortCodesByOwnerIds(ownerIds: readonly string[]) {
    const sortCodes = await getSortCodesByOwnerIds.run(
      {
        ownerIds,
      },
      this.db,
    );
    return ownerIds.map(id => sortCodes.filter(record => record.owner_id === id));
  }

  public getSortCodesByOwnerIdLoader = new DataLoader((ownerIds: readonly string[]) =>
    this.batchSortCodesByOwnerIds(ownerIds),
  );

  private async batchSortCodesByIds(keys: readonly { key: number; ownerId: string }[]) {
    const sortCodes = await getSortCodesByIds.run(
      {
        isSortCodesIds: keys.length > 0 ? 1 : 0,
        sortCodesIds: keys.map(k => k.key),
      },
      this.db,
    );
    return keys.map(k =>
      sortCodes.find(record => record.key === k.key && record.owner_id === k.ownerId),
    );
  }

  public getSortCodesByIdLoader = new DataLoader(
    (keys: readonly { key: number; ownerId: string }[]) => this.batchSortCodesByIds(keys),
  );

  public async addSortCode(params: IInsertSortCodeParams) {
    this.clearCache();
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    return insertSortCode.run(reassureOwnerIdExists(params, ownerId), this.db);
  }

  public async updateSortCode(params: IUpdateSortCodeParams) {
    this.clearCache();
    return updateSortCode.run(params, this.db);
  }

  public clearCache() {
    this.getSortCodesByIdLoader.clearAll();
    this.allSortCodesCache = null;
  }
}
