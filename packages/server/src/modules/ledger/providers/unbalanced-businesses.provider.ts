import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IDeleteChargeUnbalancedBusinessesByBusinessIdQuery,
  IDeleteChargeUnbalancedBusinessesByChargeIdParams,
  IDeleteChargeUnbalancedBusinessesByChargeIdQuery,
  IDeleteChargeUnbalancedBusinessesParams,
  IDeleteChargeUnbalancedBusinessesQuery,
  IGetChargeUnbalancedBusinessesByChargeIdsQuery,
  IInsertChargeUnbalancedBusinessesParams,
  IInsertChargeUnbalancedBusinessesQuery,
  IUpdateChargeUnbalancedBusinessParams,
  IUpdateChargeUnbalancedBusinessQuery,
} from '../types.js';

const getChargeUnbalancedBusinessesByChargeIds = sql<IGetChargeUnbalancedBusinessesByChargeIdsQuery>`
    SELECT * FROM accounter_schema.charge_unbalanced_ledger_businesses
    WHERE charge_id IN $$chargeIds;`;

const insertChargeUnbalancedBusinesses = sql<IInsertChargeUnbalancedBusinessesQuery>`
  INSERT INTO accounter_schema.charge_unbalanced_ledger_businesses (charge_id, business_id, remark)
  VALUES $$unbalancedBusinesses(chargeId, businessId, remark)
  ON CONFLICT DO NOTHING
  RETURNING *;
`;

const deleteChargeUnbalancedBusinesses = sql<IDeleteChargeUnbalancedBusinessesQuery>`
    DELETE FROM accounter_schema.charge_unbalanced_ledger_businesses
    WHERE charge_id = $chargeId
        AND business_id IN $$businessIds;`;

const deleteChargeUnbalancedBusinessesByBusinessId = sql<IDeleteChargeUnbalancedBusinessesByBusinessIdQuery>`
    DELETE FROM accounter_schema.charge_unbalanced_ledger_businesses
    WHERE business_id = $businessId;`;

const deleteChargeUnbalancedBusinessesByChargeId = sql<IDeleteChargeUnbalancedBusinessesByChargeIdQuery>`
    DELETE FROM accounter_schema.charge_unbalanced_ledger_businesses
    WHERE charge_id = $chargeId;`;

const updateChargeUnbalancedBusiness = sql<IUpdateChargeUnbalancedBusinessQuery>`
  UPDATE accounter_schema.charge_unbalanced_ledger_businesses
  SET remark = $remark
  WHERE charge_id = $chargeId
    AND business_id = $businessId
  RETURNING *;
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class UnbalancedBusinessesProvider {
  constructor(private db: TenantAwareDBClient) {}

  private async batchChargeUnbalancedBusinessesByChargeIds(chargeIds: readonly string[]) {
    const ids = new Set(chargeIds);
    const unbalancedBusinesses = await getChargeUnbalancedBusinessesByChargeIds.run(
      {
        chargeIds: Array.from(ids),
      },
      this.db,
    );
    return chargeIds.map(id =>
      unbalancedBusinesses.filter(unbalancedBusiness => unbalancedBusiness.charge_id === id),
    );
  }

  public getChargeUnbalancedBusinessesByChargeIds = new DataLoader((keys: readonly string[]) =>
    this.batchChargeUnbalancedBusinessesByChargeIds(keys),
  );

  public insertChargeUnbalancedBusinesses(params: IInsertChargeUnbalancedBusinessesParams) {
    if (params.unbalancedBusinesses.length) {
      params.unbalancedBusinesses.map(({ chargeId }) => {
        if (chargeId) this.invalidateByChargeId(chargeId);
      });
    }
    return insertChargeUnbalancedBusinesses.run(params, this.db);
  }

  public deleteChargeUnbalancedBusinesses(params: IDeleteChargeUnbalancedBusinessesParams) {
    if (params.chargeId) {
      this.invalidateByChargeId(params.chargeId);
    }
    return deleteChargeUnbalancedBusinesses.run(params, this.db);
  }

  public deleteChargeUnbalancedBusinessesByChargeId(
    params: IDeleteChargeUnbalancedBusinessesByChargeIdParams,
  ) {
    if (params.chargeId) {
      this.invalidateByChargeId(params.chargeId);
    }
    return deleteChargeUnbalancedBusinessesByChargeId.run(params, this.db);
  }

  public deleteChargeUnbalancedBusinessesByBusinessId(businessId: string) {
    return deleteChargeUnbalancedBusinessesByBusinessId.run({ businessId }, this.db);
  }

  public updateChargeUnbalancedBusiness(params: IUpdateChargeUnbalancedBusinessParams) {
    if (params.chargeId) {
      this.invalidateByChargeId(params.chargeId);
    }
    return updateChargeUnbalancedBusiness.run(params, this.db);
  }

  public async invalidateByChargeId(chargeId: string) {
    this.getChargeUnbalancedBusinessesByChargeIds.clear(chargeId);
  }

  public clearCache() {
    this.getChargeUnbalancedBusinessesByChargeIds.clearAll();
  }
}
