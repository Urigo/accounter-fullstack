import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllSalaryRecordsQuery,
  IGetSalaryRecordsByMonthParams,
  IGetSalaryRecordsByMonthQuery,
} from '../types.js';

const getAllSalaryRecords = sql<IGetAllSalaryRecordsQuery>`
    SELECT *
    FROM accounter_schema.salaries;`;

const getSalaryRecordsByMonth = sql<IGetSalaryRecordsByMonthQuery>`
    SELECT *
    FROM accounter_schema.salaries
    WHERE month = $month;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class SalariesProvider {
  constructor(private dbProvider: DBProvider) {}

  public getSalaryRecordsByMonth(params: IGetSalaryRecordsByMonthParams) {
    if (!params.month) {
      return [];
    }
    return getSalaryRecordsByMonth.run(params, this.dbProvider);
  }

  private async batchSalaryRecordsByMonth(params: readonly string[]) {
    const salaries = await getAllSalaryRecords.run(undefined, this.dbProvider);
    return params.map(month => salaries.filter(record => record.month === month));
  }

  public getSalaryRecordsByMonthLoader = new DataLoader(
    (months: readonly string[]) => this.batchSalaryRecordsByMonth(months),
    { cache: false },
  );

  public getAllTags() {
    return getAllSalaryRecords.run(undefined, this.dbProvider);
  }
}
