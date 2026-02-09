import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../app-providers/db.provider.js';
import type { IGetAllTaxVariablesQuery } from '../types.js';

const getAllTaxVariables = sql<IGetAllTaxVariablesQuery>`
  SELECT *
  FROM accounter_schema.business_trips_tax_variables
  ORDER BY date DESC;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripTaxVariablesProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchTaxVariablesByDates(dates: readonly Date[]) {
    const taxVariables = await getAllTaxVariables.run(undefined, this.dbProvider);
    return dates.map(date => taxVariables.find(record => date.getTime() >= record.date.getTime()));
  }

  public getTaxVariablesByDateLoader = new DataLoader((dates: readonly Date[]) =>
    this.batchTaxVariablesByDates(dates),
  );

  public clearCache() {
    this.getTaxVariablesByDateLoader.clearAll();
  }
}
