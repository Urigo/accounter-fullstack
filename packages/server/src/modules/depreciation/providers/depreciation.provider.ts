import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { reassureOwnerIdExists } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IDeleteDepreciationRecordByChargeIdParams,
  IDeleteDepreciationRecordByChargeIdQuery,
  IDeleteDepreciationRecordParams,
  IDeleteDepreciationRecordQuery,
  IGetDepreciationRecordsActivatedByParams,
  IGetDepreciationRecordsActivatedByQuery,
  IGetDepreciationRecordsByChargeIdsQuery,
  IGetDepreciationRecordsByDatesParams,
  IGetDepreciationRecordsByDatesQuery,
  IGetDepreciationRecordsByIdsQuery,
  IInsertDepreciationRecordParams,
  IInsertDepreciationRecordQuery,
  IReplaceDepreciationRecordsChargeIdParams,
  IReplaceDepreciationRecordsChargeIdQuery,
  IUpdateDepreciationRecordParams,
  IUpdateDepreciationRecordQuery,
} from '../types.js';

const getDepreciationRecordsByChargeIds = sql<IGetDepreciationRecordsByChargeIdsQuery>`
  SELECT d.*
  FROM accounter_schema.depreciation d
  WHERE d.charge_id IN $$chargeIds;`;

const getDepreciationRecordsByIds = sql<IGetDepreciationRecordsByIdsQuery>`
  SELECT d.*
  FROM accounter_schema.depreciation d
  WHERE d.id IN $$depreciationRecordIds;`;

const getDepreciationRecordsByDates = sql<IGetDepreciationRecordsByDatesQuery>`
  WITH depreciation AS (SELECT d.*
                      FROM accounter_schema.depreciation d
                      WHERE activation_date <= $toDate)
  -- Disposed cost is in the local currency. A foreign-currency asset without a local override has
  -- its local cost only once converted, so it is kept here unfiltered: the engine is authoritative,
  -- and an asset it finds fully disposed of simply contributes a zero row.
  SELECT d.*
  FROM depreciation d
  WHERE COALESCE(d.local_amount, d.amount) IS NULL
    OR (d.local_amount IS NULL AND d.currency IS NOT NULL AND d.currency <> $localCurrency)
    OR ROUND(COALESCE(d.local_amount, d.amount)) > COALESCE((
      SELECT SUM(ROUND(dd.disposed_cost))
      FROM accounter_schema.depreciation_disposals dd
      WHERE dd.depreciation_id = d.id
        AND dd.disposal_date < $fromDate
    ), 0);`;

const getDepreciationRecordsActivatedBy = sql<IGetDepreciationRecordsActivatedByQuery>`
  SELECT d.*
  FROM accounter_schema.depreciation d
  WHERE d.activation_date <= $date
    AND d.owner_id = $ownerId
  ORDER BY d.activation_date, d.id;`;

const replaceDepreciationRecordsChargeId = sql<IReplaceDepreciationRecordsChargeIdQuery>`
  UPDATE accounter_schema.depreciation
  SET charge_id = $assertChargeID
  WHERE charge_id = $replaceChargeID
  RETURNING id;`;

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
  ),
  local_amount = CASE
    WHEN $clearLocalAmount::boolean THEN NULL
    ELSE COALESCE($localAmount, local_amount)
  END
  WHERE
    id = $id
  RETURNING *;`;

const insertDepreciationRecord = sql<IInsertDepreciationRecordQuery>`
  INSERT INTO accounter_schema.depreciation (charge_id, amount, local_amount, currency, activation_date, type, category, owner_id)
  VALUES ($chargeId, $amount, $localAmount, $currency, $activationDate, $type, $categoryId, $ownerId)
  RETURNING *`;

const deleteDepreciationRecord = sql<IDeleteDepreciationRecordQuery>`
  DELETE FROM accounter_schema.depreciation
  WHERE id = $depreciationRecordId
  RETURNING id;
`;

const deleteDepreciationRecordByChargeId = sql<IDeleteDepreciationRecordByChargeIdQuery>`
  DELETE FROM accounter_schema.depreciation
  WHERE charge_id = $chargeId
  RETURNING id;
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class DepreciationProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
  ) {}

  private async batchDepreciationRecordsByIds(depreciationRecordIds: readonly string[]) {
    const records = await getDepreciationRecordsByIds.run(
      {
        depreciationRecordIds,
      },
      this.db,
    );
    return depreciationRecordIds.map(id => records.find(record => record.id === id));
  }

  public getDepreciationRecordByIdLoader = new DataLoader((ids: readonly string[]) =>
    this.batchDepreciationRecordsByIds(ids),
  );

  private async batchDepreciationRecordsByChargeIds(chargeIds: readonly string[]) {
    const records = await getDepreciationRecordsByChargeIds.run(
      {
        chargeIds,
      },
      this.db,
    );
    records.map(record => {
      this.getDepreciationRecordByIdLoader.prime(record.id, record);
    });
    return chargeIds.map(id => records.filter(record => record.charge_id === id));
  }

  public getDepreciationRecordsByChargeIdLoader = new DataLoader((ids: readonly string[]) =>
    this.batchDepreciationRecordsByChargeIds(ids),
  );

  /**
   * Assets on the books during the period: activated by `toDate` and not fully disposed of before
   * `fromDate`. Fully depreciated assets that are still owned are included, and so are records in a
   * category that is not depreciated (0%).
   */
  public async getDepreciationRecordsByDates(
    params: Omit<IGetDepreciationRecordsByDatesParams, 'localCurrency'>,
  ) {
    const { defaultLocalCurrency } = await this.adminContextProvider.getVerifiedAdminContext();
    const records = await getDepreciationRecordsByDates.run(
      { ...params, localCurrency: defaultLocalCurrency },
      this.db,
    );
    for (const record of records) {
      this.getDepreciationRecordByIdLoader.prime(record.id, record);
    }
    return records;
  }

  /**
   * Every asset of the business being written to, activated on or before `date`, including fully
   * depreciated and disposed ones, and those in a category that is not depreciated (0%)
   */
  public async getDepreciationRecordsActivatedBy(
    params: Omit<IGetDepreciationRecordsActivatedByParams, 'ownerId'>,
  ) {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    const records = await getDepreciationRecordsActivatedBy.run({ ...params, ownerId }, this.db);
    for (const record of records) {
      this.getDepreciationRecordByIdLoader.prime(record.id, record);
    }
    return records;
  }

  public updateDepreciationRecord(params: IUpdateDepreciationRecordParams) {
    this.clearCache();
    return updateDepreciationRecord.run(params, this.db);
  }

  public async insertDepreciationRecord(params: IInsertDepreciationRecordParams) {
    this.clearCache();
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    return insertDepreciationRecord.run(reassureOwnerIdExists(params, ownerId), this.db);
  }

  public replaceDepreciationRecordsChargeId(params: IReplaceDepreciationRecordsChargeIdParams) {
    this.clearCache();
    return replaceDepreciationRecordsChargeId.run(params, this.db);
  }

  public deleteDepreciationRecord(params: IDeleteDepreciationRecordParams) {
    this.clearCache();
    return deleteDepreciationRecord.run(params, this.db);
  }

  public deleteDepreciationRecordByChargeId(params: IDeleteDepreciationRecordByChargeIdParams) {
    this.clearCache();
    return deleteDepreciationRecordByChargeId.run(params, this.db);
  }

  public clearCache() {
    this.getDepreciationRecordByIdLoader.clearAll();
    this.getDepreciationRecordsByChargeIdLoader.clearAll();
  }
}
