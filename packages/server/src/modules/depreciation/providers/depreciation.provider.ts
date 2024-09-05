import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IDeleteDepreciationRecordByChargeIdParams,
  IDeleteDepreciationRecordByChargeIdQuery,
  IDeleteDepreciationRecordParams,
  IDeleteDepreciationRecordQuery,
  IGetDepreciationRecordsByChargeIdsQuery,
  IGetDepreciationRecordsByDatesParams,
  IGetDepreciationRecordsByDatesQuery,
  IGetDepreciationRecordsByIdsQuery,
  IInsertDepreciationRecordParams,
  IInsertDepreciationRecordQuery,
  IUpdateDepreciationRecordParams,
  IUpdateDepreciationRecordQuery,
} from '../types.js';

const getDepreciationRecordsByChargeIds = sql<IGetDepreciationRecordsByChargeIdsQuery>`
  SELECT d.*, (d.activation_date + (CONCAT((100 / dc.percentage * 365)::text, ' day'))::interval)::date as expiration_date
  FROM accounter_schema.depreciation d
  LEFT JOIN accounter_schema.depreciation_categories dc
            ON d.category = dc.id
  WHERE d.charge_id IN $$chargeIds;`;

const getDepreciationRecordsByIds = sql<IGetDepreciationRecordsByIdsQuery>`
  SELECT d.*, (d.activation_date + (CONCAT((100 / dc.percentage * 365)::text, ' day'))::interval)::date as expiration_date
  FROM accounter_schema.depreciation d
  LEFT JOIN accounter_schema.depreciation_categories dc
            ON d.category = dc.id
  WHERE d.id IN $$depreciationRecordIds;`;

const getDepreciationRecordsByDates = sql<IGetDepreciationRecordsByDatesQuery>`
  WITH depreciation AS (SELECT d.*,
                              (activation_date +
                              (CONCAT((100 / dc.percentage * 365)::text, ' day'))::interval)::date AS expiration_date
                      FROM accounter_schema.depreciation d
                                LEFT JOIN accounter_schema.depreciation_categories dc
                                          ON d.category = dc.id
                      WHERE activation_date <= $toDate)
  SELECT *
  FROM depreciation
  WHERE expiration_date >= $fromDate;`;

const updateDepreciationRecord = sql<IUpdateDepreciationRecordQuery>`
  UPDATE accounter_schema.depreciation
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

const insertDepreciationRecord = sql<IInsertDepreciationRecordQuery>`
  INSERT INTO accounter_schema.depreciation (charge_id, amount, currency, activation_date, type, category)
  VALUES ($charge_id, $amount, $currency, $activationDate, $type, $categoryId)
  RETURNING *`;

const deleteDepreciationRecord = sql<IDeleteDepreciationRecordQuery>`
  DELETE FROM accounter_schema.depreciation
  WHERE id = $depreciationRecordId
  RETURNING id;
`;

const deleteDepreciationRecordByChargeId = sql<IDeleteDepreciationRecordByChargeIdQuery>`
  DELETE FROM accounter_schema.depreciation
  WHERE id = $chargeId
  RETURNING id;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class DepreciationProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchDepreciationRecordsByIds(depreciationRecordIds: readonly string[]) {
    const records = await getDepreciationRecordsByIds.run(
      {
        depreciationRecordIds,
      },
      this.dbProvider,
    );
    return depreciationRecordIds.map(id => records.find(record => record.id === id));
  }

  public getDepreciationRecordByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchDepreciationRecordsByIds(ids),
    {
      cacheKeyFn: key => `depreciation-record-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchDepreciationRecordsByChargeIds(chargeIds: readonly string[]) {
    const records = await getDepreciationRecordsByChargeIds.run(
      {
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(id => records.filter(record => record.charge_id === id));
  }

  public getDepreciationRecordsByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchDepreciationRecordsByChargeIds(ids),
    {
      cacheKeyFn: key => `depreciation-records-by-charge-${key}`,
      cacheMap: this.cache,
    },
  );

  public getDepreciationRecordsByDates(params: IGetDepreciationRecordsByDatesParams) {
    return getDepreciationRecordsByDates.run(params, this.dbProvider);
  }

  public updateDepreciationRecord(params: IUpdateDepreciationRecordParams) {
    this.clearCache();
    return updateDepreciationRecord.run(params, this.dbProvider);
  }

  public insertDepreciationRecord(params: IInsertDepreciationRecordParams) {
    this.clearCache();
    return insertDepreciationRecord.run(params, this.dbProvider);
  }

  public deleteDepreciationRecord(params: IDeleteDepreciationRecordParams) {
    this.cache.clear();
    return deleteDepreciationRecord.run(params, this.dbProvider);
  }

  public deleteDepreciationRecordByChargeId(params: IDeleteDepreciationRecordByChargeIdParams) {
    this.cache.clear();
    return deleteDepreciationRecordByChargeId.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
