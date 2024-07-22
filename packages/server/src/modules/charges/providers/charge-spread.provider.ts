import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
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
  INSERT INTO accounter_schema.charge_spread (charge_id, year_of_relevance, amount)
  VALUES $$chargeSpread(
    chargeId,
    yearOfRelevance,
    amount
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
  scope: Scope.Singleton,
  global: true,
})
export class ChargeSpreadProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchChargesSpreadByChargeIds(ids: readonly string[]) {
    const charges = await getChargesSpreadByChargeIds.run(
      {
        chargeIds: ids,
      },
      this.dbProvider,
    );
    return ids.map(id => charges.filter(chargeSpread => chargeSpread.charge_id === id));
  }

  public getChargeSpreadByChargeIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchChargesSpreadByChargeIds(keys),
    { cache: false },
  );

  public updateChargeSpread(params: IUpdateChargeSpreadParams) {
    return updateChargeSpread.run(params, this.dbProvider);
  }

  public insertChargeSpread(params: IInsertChargeSpreadParams) {
    return insertChargeSpread.run(params, this.dbProvider);
  }

  public deleteAllChargeSpreadByChargeIds(params: IDeleteAllChargeSpreadByChargeIdsParams) {
    return deleteAllChargeSpreadByChargeIds.run(params, this.dbProvider);
  }

  public deleteAllChargeSpreadByChargeIdAndYearOfRelevance(
    params: IDeleteAllChargeSpreadByChargeIdAndYearOfRelevanceParams,
  ) {
    return deleteAllChargeSpreadByChargeIdAndYearOfRelevance.run(params, this.dbProvider);
  }
}
