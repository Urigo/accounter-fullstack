import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import type { Pool } from 'pg';

import type {
  IGetFinancialEntitiesByIdsQuery,
  IGetFinancialEntitiesByNamesQuery,
} from '../generated-types/financial-entities.provider.types.mjs';

const { sql } = pgQuery;

const getFinancialEntitiesByIds = sql<IGetFinancialEntitiesByIdsQuery>`
    SELECT *
    FROM accounter_schema.businesses
    WHERE id IN $$ids;`;

const getFinancialEntitiesByNames = sql<IGetFinancialEntitiesByNamesQuery>`
    SELECT *
    FROM accounter_schema.businesses
    WHERE name IN $$names;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class FinancialEntitiesProvider {
  constructor(private pool: Pool) {}

  private batchFinancialEntitiesByIds = async (ids: readonly string[]) => {
    const financialEntities = await getFinancialEntitiesByIds.run(
      {
        ids,
      },
      this.pool
    );
    return ids.map(id => financialEntities.find(fe => fe.id === id));
  };

  public getFinancialEntityByIdLoader = new DataLoader(this.batchFinancialEntitiesByIds, { cache: false });

  private batchFinancialEntitiesByNames = async (names: readonly string[]) => {
    const financialEntities = await getFinancialEntitiesByNames.run(
      {
        names,
      },
      this.pool
    );
    return names.map(name => financialEntities.find(fe => fe.name === name));
  };

  public getFinancialEntityByNameLoader = new DataLoader(this.batchFinancialEntitiesByNames, { cache: false });
}
