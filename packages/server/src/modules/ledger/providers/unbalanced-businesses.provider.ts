import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
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
  scope: Scope.Singleton,
  global: true,
})
export class UnbalancedBusinessesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchChargeUnbalancedBusinessesByChargeIds(chargeIds: readonly string[]) {
    const ids = new Set(chargeIds);
    const unbalancedBusinesses = await getChargeUnbalancedBusinessesByChargeIds.run(
      {
        chargeIds: Array.from(ids),
      },
      this.dbProvider,
    );
    return chargeIds.map(id =>
      unbalancedBusinesses.filter(unbalancedBusiness => unbalancedBusiness.charge_id === id),
    );
  }

  public getChargeUnbalancedBusinessesByChargeIds = new DataLoader(
    (keys: readonly string[]) => this.batchChargeUnbalancedBusinessesByChargeIds(keys),
    {
      cacheKeyFn: key => `unbalanced-businesses-charge-${key}`,
      cacheMap: this.cache,
    },
  );

  public insertChargeUnbalancedBusinesses(params: IInsertChargeUnbalancedBusinessesParams) {
    if (params.unbalancedBusinesses.length) {
      params.unbalancedBusinesses.map(({ chargeId }) => {
        if (chargeId) this.invalidateByChargeId(chargeId);
      });
    }
    return insertChargeUnbalancedBusinesses.run(params, this.dbProvider);
  }

  public deleteChargeUnbalancedBusinesses(params: IDeleteChargeUnbalancedBusinessesParams) {
    if (params.chargeId) {
      this.invalidateByChargeId(params.chargeId);
    }
    return deleteChargeUnbalancedBusinesses.run(params, this.dbProvider);
  }

  public deleteChargeUnbalancedBusinessesByChargeId(
    params: IDeleteChargeUnbalancedBusinessesByChargeIdParams,
  ) {
    if (params.chargeId) {
      this.invalidateByChargeId(params.chargeId);
    }
    return deleteChargeUnbalancedBusinessesByChargeId.run(params, this.dbProvider);
  }

  public deleteChargeUnbalancedBusinessesByBusinessId(businessId: string) {
    return deleteChargeUnbalancedBusinessesByBusinessId.run({ businessId }, this.dbProvider);
  }

  public updateChargeUnbalancedBusiness(params: IUpdateChargeUnbalancedBusinessParams) {
    if (params.chargeId) {
      this.invalidateByChargeId(params.chargeId);
    }
    return updateChargeUnbalancedBusiness.run(params, this.dbProvider);
  }

  public async invalidateByChargeId(chargeId: string) {
    this.cache.delete(`unbalanced-businesses-charge-${chargeId}`);
  }

  public clearCache() {
    this.cache.clear();
  }
}
