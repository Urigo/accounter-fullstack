import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IDeleteDeprecationRecordByChargeIdParams,
  IDeleteDeprecationRecordByChargeIdQuery,
  IDeleteDeprecationRecordParams,
  IDeleteDeprecationRecordQuery,
  IGetDeprecationRecordsByChargeIdsQuery,
  IGetDeprecationRecordsByIdsQuery,
  IInsertDeprecationRecordParams,
  IInsertDeprecationRecordQuery,
  IUpdateDeprecationRecordParams,
  IUpdateDeprecationRecordQuery,
} from '../types.js';

const getDeprecationRecordsByChargeIds = sql<IGetDeprecationRecordsByChargeIdsQuery>`
  SELECT *
  FROM accounter_schema.deprecation
  WHERE charge_id IN $$chargeIds;`;

const getDeprecationRecordsByIds = sql<IGetDeprecationRecordsByIdsQuery>`
  SELECT *
  FROM accounter_schema.deprecation
  WHERE id IN $$deprecationRecordIds;`;

const updateDeprecationRecord = sql<IUpdateDeprecationRecordQuery>`
  UPDATE accounter_schema.deprecation
  SET
  charge_id = COALESCE(
    $chargeId,
    charge_id
  ),
  amount = COALESCE(
    $amount,
    amount
  ),
  currency = COALESCE(
    $currency,
    currency
  ),
  activation_date = COALESCE(
    $activationDate,
    activation_date
  ),
  type = COALESCE(
    $type,
    type
  ),
  category = COALESCE(
    $categoryId,
    category
  )
  WHERE
    id = $id
  RETURNING *;`;

const insertDeprecationRecord = sql<IInsertDeprecationRecordQuery>`
  INSERT INTO accounter_schema.deprecation (charge_id, amount, currency, activation_date, type, category)
  VALUES ($charge_id, $amount, $currency, $activationDate, $type, $categoryId)
  RETURNING *`;

const deleteDeprecationRecord = sql<IDeleteDeprecationRecordQuery>`
  DELETE FROM accounter_schema.deprecation
  WHERE id = $deprecationRecordId
  RETURNING id;
`;

const deleteDeprecationRecordByChargeId = sql<IDeleteDeprecationRecordByChargeIdQuery>`
  DELETE FROM accounter_schema.deprecation
  WHERE id = $chargeId
  RETURNING id;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class DeprecationProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchDeprecationRecordsByIds(deprecationRecordIds: readonly string[]) {
    const records = await getDeprecationRecordsByIds.run(
      {
        deprecationRecordIds,
      },
      this.dbProvider,
    );
    return deprecationRecordIds.map(id => records.find(record => record.id === id));
  }

  public getDeprecationRecordByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchDeprecationRecordsByIds(ids),
    {
      cacheKeyFn: key => `deprecation-record-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchDeprecationRecordsByChargeIds(chargeIds: readonly string[]) {
    const records = await getDeprecationRecordsByChargeIds.run(
      {
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(id => records.filter(record => record.charge_id === id));
  }

  public getDeprecationRecordsByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchDeprecationRecordsByChargeIds(ids),
    {
      cacheKeyFn: key => `deprecation-records-by-charge-${key}`,
      cacheMap: this.cache,
    },
  );

  public updateDeprecationRecord(params: IUpdateDeprecationRecordParams) {
    this.clearCache();
    return updateDeprecationRecord.run(params, this.dbProvider);
  }

  public insertDeprecationRecord(params: IInsertDeprecationRecordParams) {
    this.clearCache();
    return insertDeprecationRecord.run(params, this.dbProvider);
  }

  public deleteDeprecationRecord(params: IDeleteDeprecationRecordParams) {
    this.cache.clear();
    return deleteDeprecationRecord.run(params, this.dbProvider);
  }

  public deleteDeprecationRecordByChargeId(params: IDeleteDeprecationRecordByChargeIdParams) {
    this.cache.clear();
    return deleteDeprecationRecordByChargeId.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
