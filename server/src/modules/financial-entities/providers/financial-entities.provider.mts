import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { Pool } from 'pg';

const { sql } = pgQuery;

@Injectable({
    scope: Scope.Singleton,
    global: true
  })
  export class FinancialEntitiesProvider {
    constructor(
      private pool: Pool,
    ) {
    }

    private getFinancialEntitiesByIds = sql<IGetFinancialEntitiesByIdsQuery>`
        SELECT *
        FROM accounter_schema.businesses
        WHERE id IN $$ids;`;

    private batchFinancialEntitiesByIds = async (ids: readonly string[]) => {
        const financialEntities = await this.getFinancialEntitiesByIds.run(
            {
            ids,
            },
            this.pool
        );
        return ids.map(id => financialEntities.find(fe => fe.id === id));
    }

    public getFinancialEntityByIdLoader = new DataLoader(this.batchFinancialEntitiesByIds, { cache: false });

    private getFinancialEntitiesByNames = sql<IGetFinancialEntitiesByNamesQuery>`
        SELECT *
        FROM accounter_schema.businesses
        WHERE name IN $$names;`;

    private batchFinancialEntitiesByNames = async (names: readonly string[]) => {
    const financialEntities = await this.getFinancialEntitiesByNames.run(
        {
        names,
        },
        this.pool
    );
    return names.map(name => financialEntities.find(fe => fe.name === name));
    }

    public getFinancialEntityByNameLoader = new DataLoader(this.batchFinancialEntitiesByNames, { cache: false });
}