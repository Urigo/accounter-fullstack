import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { reassureOwnerIdExists } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IDeleteDepreciationDisposalParams,
  IDeleteDepreciationDisposalQuery,
  IGetDepreciationDisposalsByChargeIdsQuery,
  IGetDepreciationDisposalsByDatesParams,
  IGetDepreciationDisposalsByDatesQuery,
  IGetDepreciationDisposalsByDepreciationIdsQuery,
  IGetDepreciationDisposalsByIdsQuery,
  IInsertDepreciationDisposalParams,
  IInsertDepreciationDisposalQuery,
  IReplaceDepreciationDisposalsChargeIdParams,
  IReplaceDepreciationDisposalsChargeIdQuery,
  IUpdateDepreciationDisposalParams,
  IUpdateDepreciationDisposalQuery,
} from '../types.js';

const getDepreciationDisposalsByIds = sql<IGetDepreciationDisposalsByIdsQuery>`
  SELECT *
  FROM accounter_schema.depreciation_disposals
  WHERE id IN $$ids;`;

const getDepreciationDisposalsByDepreciationIds = sql<IGetDepreciationDisposalsByDepreciationIdsQuery>`
  SELECT *
  FROM accounter_schema.depreciation_disposals
  WHERE depreciation_id IN $$depreciationIds
  ORDER BY disposal_date, id;`;

const getDepreciationDisposalsByChargeIds = sql<IGetDepreciationDisposalsByChargeIdsQuery>`
  SELECT *
  FROM accounter_schema.depreciation_disposals
  WHERE charge_id IN $$chargeIds
  ORDER BY disposal_date, id;`;

const getDepreciationDisposalsByDates = sql<IGetDepreciationDisposalsByDatesQuery>`
  SELECT *
  FROM accounter_schema.depreciation_disposals
  WHERE disposal_date BETWEEN $fromDate AND $toDate
  ORDER BY disposal_date, id;`;

const insertDepreciationDisposal = sql<IInsertDepreciationDisposalQuery>`
  INSERT INTO accounter_schema.depreciation_disposals (
    owner_id, depreciation_id, charge_id, type, refund_mode, disposal_date, disposed_cost,
    original_amount, original_currency, proceeds, description
  )
  VALUES (
    $ownerId, $depreciationId, $chargeId, $type, $refundMode, $disposalDate, $disposedCost,
    $originalAmount, $originalCurrency, $proceeds, $description
  )
  RETURNING *;`;

const updateDepreciationDisposal = sql<IUpdateDepreciationDisposalQuery>`
  UPDATE accounter_schema.depreciation_disposals
  SET
    charge_id = CASE WHEN $clearChargeId::boolean THEN NULL ELSE COALESCE($chargeId, charge_id) END,
    type = COALESCE($type, type),
    refund_mode = $refundMode,
    disposal_date = COALESCE($disposalDate, disposal_date),
    -- a cost refund of a foreign-currency asset holds its amount in that currency and no local
    -- cost, every other event holds its local cost. Both are written as resolved.
    disposed_cost = $disposedCost,
    original_amount = $originalAmount,
    original_currency = $originalCurrency,
    proceeds = COALESCE($proceeds, proceeds),
    description = $description,
    updated_at = clock_timestamp()
  WHERE id = $id
  RETURNING *;`;

const deleteDepreciationDisposal = sql<IDeleteDepreciationDisposalQuery>`
  DELETE FROM accounter_schema.depreciation_disposals
  WHERE id = $id
  RETURNING *;`;

const replaceDepreciationDisposalsChargeId = sql<IReplaceDepreciationDisposalsChargeIdQuery>`
  UPDATE accounter_schema.depreciation_disposals
  SET charge_id = $assertChargeID, updated_at = clock_timestamp()
  WHERE charge_id = $replaceChargeID
  RETURNING id;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class DepreciationDisposalsProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
  ) {}

  private async batchDisposalsByIds(ids: readonly string[]) {
    const disposals = await getDepreciationDisposalsByIds.run({ ids }, this.db);
    return ids.map(id => disposals.find(disposal => disposal.id === id));
  }

  public getDisposalByIdLoader = new DataLoader((ids: readonly string[]) =>
    this.batchDisposalsByIds(ids),
  );

  private async batchDisposalsByDepreciationIds(depreciationIds: readonly string[]) {
    const disposals = await getDepreciationDisposalsByDepreciationIds.run(
      { depreciationIds },
      this.db,
    );
    for (const disposal of disposals) {
      this.getDisposalByIdLoader.prime(disposal.id, disposal);
    }
    return depreciationIds.map(id => disposals.filter(disposal => disposal.depreciation_id === id));
  }

  public getDisposalsByDepreciationIdLoader = new DataLoader((ids: readonly string[]) =>
    this.batchDisposalsByDepreciationIds(ids),
  );

  private async batchDisposalsByChargeIds(chargeIds: readonly string[]) {
    const disposals = await getDepreciationDisposalsByChargeIds.run({ chargeIds }, this.db);
    for (const disposal of disposals) {
      this.getDisposalByIdLoader.prime(disposal.id, disposal);
    }
    return chargeIds.map(id => disposals.filter(disposal => disposal.charge_id === id));
  }

  public getDisposalsByChargeIdLoader = new DataLoader((ids: readonly string[]) =>
    this.batchDisposalsByChargeIds(ids),
  );

  public async getDisposalsByDates(params: IGetDepreciationDisposalsByDatesParams) {
    const disposals = await getDepreciationDisposalsByDates.run(params, this.db);
    for (const disposal of disposals) {
      this.getDisposalByIdLoader.prime(disposal.id, disposal);
    }
    return disposals;
  }

  public async insertDisposal(params: IInsertDepreciationDisposalParams) {
    this.clearCache();
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    return insertDepreciationDisposal.run(reassureOwnerIdExists(params, ownerId), this.db);
  }

  public updateDisposal(params: IUpdateDepreciationDisposalParams) {
    this.clearCache();
    return updateDepreciationDisposal.run(params, this.db);
  }

  public deleteDisposal(params: IDeleteDepreciationDisposalParams) {
    this.clearCache();
    return deleteDepreciationDisposal.run(params, this.db);
  }

  public replaceDisposalsChargeId(params: IReplaceDepreciationDisposalsChargeIdParams) {
    this.clearCache();
    return replaceDepreciationDisposalsChargeId.run(params, this.db);
  }

  public clearCache() {
    this.getDisposalByIdLoader.clearAll();
    this.getDisposalsByDepreciationIdLoader.clearAll();
    this.getDisposalsByChargeIdLoader.clearAll();
  }
}
