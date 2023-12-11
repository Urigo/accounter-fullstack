import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllFundsParams,
  IGetAllFundsQuery,
  IGetBatchedEmployeesByEmployerIdsQuery,
} from '../types.js';

const getBatchedEmployeesByEmployerIds = sql<IGetBatchedEmployeesByEmployerIdsQuery>`
    SELECT * FROM accounter_schema.employees
    WHERE employer IN $$employweIds;`;

const getAllFunds = sql<IGetAllFundsQuery>`
  SELECT * FROM accounter_schema.pension_funds;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class SalariesLedgerProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchBatchedEmployeesByEmployerIds(employweIds: readonly string[]) {
    const ids = new Set(employweIds);
    const employees = await getBatchedEmployeesByEmployerIds.run(
      {
        employweIds: Array.from(ids),
      },
      this.dbProvider,
    );
    return employweIds.map(id => employees.filter(employee => employee.employer === id));
  }

  public getChargeByFinancialEntityIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchBatchedEmployeesByEmployerIds(keys),
    {
      cache: false,
    },
  );

  public getAllFunds(params: IGetAllFundsParams) {
    return getAllFunds.run(params, this.dbProvider);
  }
}
