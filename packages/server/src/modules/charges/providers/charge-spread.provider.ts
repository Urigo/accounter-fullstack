import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IDeleteAllChargeSpreadByChargeIdAndYearOfRelevanceParams,
  IDeleteAllChargeSpreadByChargeIdAndYearOfRelevanceQuery,
  IDeleteAllChargeSpreadByChargeIdsParams,
  IDeleteAllChargeSpreadByChargeIdsQuery,
  IGetChargesSpreadByChargeIdsQuery,
  IInsertChargeSpreadParams,
  IInsertChargeSpreadQuery,
  IUpdateChargeSpreadParams,
  IUpdateChargeSpreadQuery,
} from '../types.js';

const getChargesSpreadByChargeIds = sql<IGetChargesSpreadByChargeIdsQuery>`
    SELECT *
    FROM accounter_schema.charge_spread
    WHERE charge_id IN $$chargeIds;`;

const updateChargeSpread = sql<IUpdateChargeSpreadQuery>`
  WITH variables (year) as (
    values ($year::DATE)
  )
  UPDATE accounter_schema.charge_spread
  SET
  year_of_relevance = COALESCE(
    variables.year,
    year_of_relevance
  ),
  amount = COALESCE(
    $amount,
    amount
  )
  FROM variables
  WHERE
    charge_id = $chargeId
    AND year_of_relevance = variables.year
  RETURNING *;
`;

const insertChargeSpread = sql<IInsertChargeSpreadQuery>`
  INSERT INTO accounter_schema.charge_spread (charge_id, year_of_relevance, amount, owner_id)
  VALUES $$chargeSpread(
    chargeId,
    yearOfRelevance,
    amount,
    ownerId
  )
  RETURNING *;
`;

const deleteAllChargeSpreadByChargeIds = sql<IDeleteAllChargeSpreadByChargeIdsQuery>`
    DELETE FROM accounter_schema.charge_spread
    WHERE charge_id IN $$chargeIds;`;

const deleteAllChargeSpreadByChargeIdAndYearOfRelevance = sql<IDeleteAllChargeSpreadByChargeIdAndYearOfRelevanceQuery>`
    DELETE FROM accounter_schema.charge_spread
    WHERE charge_id = $chargeId
    AND year_of_relevance = $yearOfRelevance;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class ChargeSpreadProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
  ) {}

  private async batchChargesSpreadByChargeIds(ids: readonly string[]) {
    const charges = await getChargesSpreadByChargeIds.run(
      {
        chargeIds: ids,
      },
      this.db,
    );
    return ids.map(id => charges.filter(chargeSpread => chargeSpread.charge_id === id));
  }

  public getChargeSpreadByChargeIdLoader = new DataLoader((keys: readonly string[]) =>
    this.batchChargesSpreadByChargeIds(keys),
  );

  public async updateChargeSpread(params: IUpdateChargeSpreadParams) {
    return updateChargeSpread.run(params, this.db);
  }

  public async insertChargeSpread(params: IInsertChargeSpreadParams) {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    return insertChargeSpread.run(
      {
        chargeSpread: params.chargeSpread.map(spread => ({
          ...spread,
          ownerId: spread.ownerId || ownerId,
        })),
      },
      this.db,
    );
  }

  public async deleteAllChargeSpreadByChargeIds(params: IDeleteAllChargeSpreadByChargeIdsParams) {
    return deleteAllChargeSpreadByChargeIds.run(params, this.db);
  }

  public async deleteAllChargeSpreadByChargeIdAndYearOfRelevance(
    params: IDeleteAllChargeSpreadByChargeIdAndYearOfRelevanceParams,
  ) {
    return deleteAllChargeSpreadByChargeIdAndYearOfRelevance.run(params, this.db);
  }
}
