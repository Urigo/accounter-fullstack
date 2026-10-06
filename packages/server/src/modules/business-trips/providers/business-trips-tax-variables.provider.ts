import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import type { TimelessDateString } from '../../../shared/types/index.js';
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

  private async batchTaxVariablesByDates(dates: readonly TimelessDateString[]) {
    const taxVariables = await getAllTaxVariables.run(undefined, this.dbProvider);
    return dates.map(date => taxVariables.find(record => date >= record.date));
  }

  public getTaxVariablesByDateLoader = new DataLoader((dates: readonly TimelessDateString[]) =>
    this.batchTaxVariablesByDates(dates),
  );

  public clearCache() {
    this.getTaxVariablesByDateLoader.clearAll();
  }
}
