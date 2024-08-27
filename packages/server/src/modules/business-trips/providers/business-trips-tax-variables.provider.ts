import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type { IGetAllTaxVariablesQuery } from '../types.js';

const getAllTaxVariables = sql<IGetAllTaxVariablesQuery>`
  SELECT *
  FROM accounter_schema.business_trips_tax_variables
  ORDER BY date ASC;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripTaxVariablesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  public getTaxVariablesByDate() {
    return getAllTaxVariables.run(undefined, this.dbProvider);
  }

  private async batchTaxVariablesByDates(dates: readonly Date[]) {
    const taxVariables = await getAllTaxVariables.run(undefined, this.dbProvider);
    return dates.map(date => taxVariables.find(record => date.getTime() >= record.date.getTime()));
  }

  public getTaxVariablesByDateLoader = new DataLoader(
    (dates: readonly Date[]) => this.batchTaxVariablesByDates(dates),
    {
      cacheKeyFn: date => date.getTime(),
      cache: false,
    },
  );

  public clearCache() {
    this.cache.clear();
  }
}
