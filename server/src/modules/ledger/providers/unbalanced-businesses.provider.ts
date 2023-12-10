import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IDeleteChargeUnbalancedBusinessesParams,
  IDeleteChargeUnbalancedBusinessesQuery,
  IGetChargeUnbalancedBusinessesByChargeIdsParams,
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
  constructor(private dbProvider: DBProvider) {}

  public getChargeUnbalancedBusinessesByChargeIds(
    params: IGetChargeUnbalancedBusinessesByChargeIdsParams,
  ) {
    return getChargeUnbalancedBusinessesByChargeIds.run(params, this.dbProvider);
  }

  private async batchChargesByFinancialEntityIds(chargeIds: readonly string[]) {
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

  public getChargeByFinancialEntityIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchChargesByFinancialEntityIds(keys),
    {
      cache: false,
    },
  );

  public insertChargeUnbalancedBusinesses(params: IInsertChargeUnbalancedBusinessesParams) {
    return insertChargeUnbalancedBusinesses.run(params, this.dbProvider);
  }

  public deleteChargeUnbalancedBusinesses(params: IDeleteChargeUnbalancedBusinessesParams) {
    return deleteChargeUnbalancedBusinesses.run(params, this.dbProvider);
  }

  public updateChargeUnbalancedBusiness(params: IUpdateChargeUnbalancedBusinessParams) {
    return updateChargeUnbalancedBusiness.run(params, this.dbProvider);
  }
}
