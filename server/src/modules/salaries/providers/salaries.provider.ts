import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllSalaryRecordsQuery,
  IGetSalaryRecordsByChargeIdsQuery,
  IGetSalaryRecordsByMonthParams,
  IGetSalaryRecordsByMonthQuery,
  stringArray,
} from '../types.js';

const getAllSalaryRecords = sql<IGetAllSalaryRecordsQuery>`
    SELECT *
    FROM accounter_schema.salaries;`;

const getSalaryRecordsByMonth = sql<IGetSalaryRecordsByMonthQuery>`
    SELECT *
    FROM accounter_schema.salaries
    WHERE month = $month;`;

const getSalaryRecordsByChargeIds = sql<IGetSalaryRecordsByChargeIdsQuery>`
  SELECT *
  FROM accounter_schema.salaries
  WHERE $chargeIds && ARRAY[employee_salary_charge_id, pension_charge_id, training_fund_charge_id, social_security_charge_id, tax_charge_id];
`;

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

  private async batchSalaryRecordsByMonth(months: readonly string[]) {
    const salaries = await getAllSalaryRecords.run(undefined, this.dbProvider);
    return months.map(month => salaries.filter(record => record.month === month));
  }

  public getSalaryRecordsByMonthLoader = new DataLoader(
    (months: readonly string[]) => this.batchSalaryRecordsByMonth(months),
    { cache: false },
  );

  private async batchGetSalaryRecordsByChargeIds(chargeIds: stringArray) {
    const salaries = await getSalaryRecordsByChargeIds.run({ chargeIds }, this.dbProvider);
    return chargeIds.map(id =>
      salaries.filter(record =>
        [
          record.employee_salary_charge_id,
          record.pension_charge_id,
          record.training_fund_charge_id,
          record.social_security_charge_id,
          record.tax_charge_id,
        ].includes(id),
      ),
    );
  }

  public getSalaryRecordsByChargeIdLoader = new DataLoader(
    (chargeIds: readonly string[]) =>
      this.batchGetSalaryRecordsByChargeIds(chargeIds as stringArray),
    { cache: false },
  );
}
