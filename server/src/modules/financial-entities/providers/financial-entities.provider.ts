import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllFinancialEntitiesQuery,
  IGetFinancialEntitiesByChargeIdsParams,
  IGetFinancialEntitiesByChargeIdsQuery,
  IGetFinancialEntitiesByIdsQuery,
  IGetFinancialEntitiesByNamesQuery,
} from '../types.js';

const getFinancialEntitiesByIds = sql<IGetFinancialEntitiesByIdsQuery>`
    SELECT *
    FROM accounter_schema.businesses
    WHERE id IN $$ids;`;

const getFinancialEntitiesByNames = sql<IGetFinancialEntitiesByNamesQuery>`
    SELECT *
    FROM accounter_schema.businesses
    WHERE name IN $$names;`;

const getAllFinancialEntities = sql<IGetAllFinancialEntitiesQuery>`
    SELECT *
    FROM accounter_schema.businesses;`;

const getFinancialEntitiesByChargeIds = sql<IGetFinancialEntitiesByChargeIdsQuery>`
    SELECT c.id as charge_id, bu.*
    FROM accounter_schema.charges c
    LEFT JOIN accounter_schema.businesses bu
    ON  c.owner_id = bu.id
    WHERE c.id IN $$chargeIds;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class FinancialEntitiesProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchFinancialEntitiesByIds(ids: readonly string[]) {
    const financialEntities = await getFinancialEntitiesByIds.run(
      {
        ids,
      },
      this.dbProvider,
    );
    return ids.map(id => financialEntities.find(fe => fe.id === id));
  }

  public getFinancialEntityByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchFinancialEntitiesByIds(keys),
    {
      cache: false,
    },
  );

  private async batchFinancialEntitiesByNames(names: readonly string[]) {
    const financialEntities = await getFinancialEntitiesByNames.run(
      {
        names,
      },
      this.dbProvider,
    );
    return names.map(name => financialEntities.find(fe => fe.name === name));
  }

  public getFinancialEntityByNameLoader = new DataLoader(
    (keys: readonly string[]) => this.batchFinancialEntitiesByNames(keys),
    {
      cache: false,
    },
  );

  public getAllFinancialEntities() {
    return getAllFinancialEntities.run(undefined, this.dbProvider);
  }

  public getFinancialEntitiesByChargeIds(params: IGetFinancialEntitiesByChargeIdsParams) {
    return getFinancialEntitiesByChargeIds.run(params, this.dbProvider);
  }

  private async batchFinancialEntitiesByChargeIds(chargeIds: readonly string[]) {
    const financialEntities = await getFinancialEntitiesByChargeIds.run(
      {
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(
      chargeId => financialEntities.find(fe => fe.charge_id === chargeId) ?? null,
    );
  }

  public getFinancialEntityByChargeIdsLoader = new DataLoader(
    (keys: readonly string[]) => this.batchFinancialEntitiesByChargeIds(keys),
    { cache: false },
  );
}
