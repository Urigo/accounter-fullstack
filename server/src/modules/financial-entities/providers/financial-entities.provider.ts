import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllFinancialEntitiesQuery,
  IGetFinancialEntitiesByIdsQuery,
  IGetFinancialEntitiesByNamesQuery,
  IUpdateFinancialEntityParams,
  IUpdateFinancialEntityQuery,
} from '../__generated__/financial-entities.types.js';

const getFinancialEntitiesByIds = sql<IGetFinancialEntitiesByIdsQuery>`
    SELECT *
    FROM accounter_schema.financial_entities
    WHERE id IN $$ids;`;

const getFinancialEntitiesByNames = sql<IGetFinancialEntitiesByNamesQuery>`
    SELECT *
    FROM accounter_schema.financial_entities
    WHERE name IN $$names;`;

const getAllFinancialEntities = sql<IGetAllFinancialEntitiesQuery>`
    SELECT *
    FROM accounter_schema.financial_entities;`;

const updateFinancialEntity = sql<IUpdateFinancialEntityQuery>`
  UPDATE accounter_schema.financial_entities
  SET
  name = COALESCE(
    $name,
    name
  ),
  owner_id = COALESCE(
    $ownerId,
    owner_id
  ),
  sort_code = COALESCE(
    $sortCode,
    sort_code
  ),
  type = COALESCE(
    $type,
    type
  )
  WHERE
    id = $businessId
  RETURNING *;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class FinancialEntitiesProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchFinancialEntitiesByIds(ids: readonly string[]) {
    const uniqueIds = [...new Set(ids)];
    const financialEntities = await getFinancialEntitiesByIds.run(
      {
        ids: uniqueIds,
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

  public updateFinancialEntity(params: IUpdateFinancialEntityParams) {
    return updateFinancialEntity.run(params, this.dbProvider);
  }
}
