import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { reassureOwnerIdExists } from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { depreciatesOnOrAfter } from '../helpers/asset-depreciation.helper.js';
import type {
  IDeleteDepreciationRecordByChargeIdParams,
  IDeleteDepreciationRecordByChargeIdQuery,
  IDeleteDepreciationRecordParams,
  IDeleteDepreciationRecordQuery,
  IGetDepreciationRecordsByChargeIdsQuery,
  IGetDepreciationRecordsByDatesQuery,
  IGetDepreciationRecordsByIdsQuery,
  IInsertDepreciationRecordParams,
  IInsertDepreciationRecordQuery,
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
  SELECT d.*, dc.percentage AS category_percentage
  FROM accounter_schema.depreciation d
  LEFT JOIN accounter_schema.depreciation_categories dc
            ON d.category = dc.id
  WHERE d.activation_date <= $toDate;`;

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
  INSERT INTO accounter_schema.depreciation (charge_id, amount, currency, activation_date, type, category, owner_id)
  VALUES ($chargeId, $amount, $currency, $activationDate, $type, $categoryId, $ownerId)
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
   * The records that depreciate during the given period: activated by its end, and not done
   * depreciating before its start (`depreciatesOnOrAfter`, from the category rate and the
   * activation date); records in a category that is not depreciated (0%) are always returned.
   */
  public async getDepreciationRecordsByDates({
    fromDate,
    toDate,
  }: {
    fromDate: TimelessDateString;
    toDate: TimelessDateString;
  }) {
    const rows = await getDepreciationRecordsByDates.run({ toDate }, this.db);
    const records = rows.flatMap(({ category_percentage, ...record }) =>
      depreciatesOnOrAfter(Number(category_percentage), record.activation_date, fromDate)
        ? [record]
        : [],
    );
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
