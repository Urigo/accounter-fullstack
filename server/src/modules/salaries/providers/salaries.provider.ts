import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllSalaryRecordsQuery,
  IGetSalaryRecordsByChargeIdsQuery,
  IGetSalaryRecordsByMonthParams,
  IGetSalaryRecordsByMonthQuery,
  IInsertSalaryRecordsParams,
  IInsertSalaryRecordsQuery,
  IUpdateSalaryRecordParams,
  IUpdateSalaryRecordQuery,
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
  WHERE $chargeIds && ARRAY[charge_id];
`;

const insertSalaryRecords = sql<IInsertSalaryRecordsQuery>`
  INSERT INTO accounter_schema.salaries (
    added_vacation_days,
    base_salary,
    bonus,
    charge_id,
    compensations_employer_amount,
    compensations_employer_percentage,
    direct_payment_amount,
    employee_id,
    employer,
    gift,
    global_additional_hours,
    health_payment_amount,
    hourly_rate,
    hours,
    month,
    pension_employee_amount,
    pension_employee_percentage,
    pension_employer_amount,
    pension_employer_percentage,
    pension_fund_id,
    recovery,
    sickness_days_balance,
    social_security_amount_employee,
    social_security_amount_employer,
    tax_amount,
    training_fund_employee_amount,
    training_fund_employee_percentage,
    training_fund_employer_amount,
    training_fund_employer_percentage,
    training_fund_id,
    vacation_days_balance,
    vacation_takeout,
    work_days,
    zkufot)
  VALUES $$salaryRecords(
    addedVacationDays,
    baseSalary,
    bonus,
    chargeId,
    compensationsEmployerAmount,
    compensationsEmployerPercentage,
    directPaymentAmount,
    employeeId,
    employer,
    gift,
    globalAdditionalHours,
    healthPaymentAmount,
    hourlyRate,
    hours,
    month,
    pensionEmployeeAmount,
    pensionEmployeePercentage,
    pensionEmployerAmount,
    pensionEmployerPercentage,
    pensionFundId,
    recovery,
    sicknessDaysBalance,
    socialSecurityAmountEmployee,
    socialSecurityAmountEmployer,
    taxAmount,
    trainingFundEmployeeAmount,
    trainingFundEmployeePercentage,
    trainingFundEmployerAmount,
    trainingFundEmployerPercentage,
    trainingFundId,
    vacationDaysBalance,
    vacationTakeout,
    workDays,
    zkufot)
  RETURNING *;
`;

const updateSalaryRecord = sql<IUpdateSalaryRecordQuery>`
  UPDATE accounter_schema.salaries
  SET
    added_vacation_days = COALESCE(
      $addedVacationDays,
      added_vacation_days
    ),
    base_salary = COALESCE(
      $baseSalary,
      base_salary
    ),
    bonus = COALESCE(
      $bonus,
      bonus
    ),
    charge_id = COALESCE(
      $chargeId,
      charge_id
    ),
    compensations_employer_amount = COALESCE(
      $compensationsEmployerAmount,
      compensations_employer_amount
    ),
    compensations_employer_percentage = COALESCE(
      $compensationsEmployerPercentage,
      compensations_employer_percentage
    ),
    direct_payment_amount = COALESCE(
      $directPaymentAmount,
      direct_payment_amount
    ),
    employer = COALESCE(
      $employer,
      employer
    ),
    gift = COALESCE(
      $gift,
      gift
    ),
    global_additional_hours = COALESCE(
      $globalAdditionalHours,
      global_additional_hours
    ),
    health_payment_amount = COALESCE(
      $healthPaymentAmount,
      health_payment_amount
    ),
    hourly_rate = COALESCE(
      $hourlyRate,
      hourly_rate
    ),
    hours = COALESCE(
      $hours,
      hours
    ),
    pension_employee_amount = COALESCE(
      $pensionEmployeeAmount,
      pension_employee_amount
    ),
    pension_employee_percentage = COALESCE(
      $pensionEmployeePercentage,
      pension_employee_percentage
    ),
    pension_employer_amount = COALESCE(
      $pensionEmployerAmount,
      pension_employer_amount
    ),
    pension_employer_percentage = COALESCE(
      $pensionEmployerPercentage,
      pension_employer_percentage
    ),
    pension_fund_id = COALESCE(
      $pensionFundId,
      pension_fund_id
    ),
    recovery = COALESCE(
      $recovery,
      recovery
    ),
    sickness_days_balance = COALESCE(
      $sicknessDaysBalance,
      sickness_days_balance
    ),
    social_security_amount_employee = COALESCE(
      $socialSecurityAmountEmployee,
      social_security_amount_employee
    ),
    social_security_amount_employer = COALESCE(
      $socialSecurityAmountEmployer,
      social_security_amount_employer
    ),
    tax_amount = COALESCE(
      $taxAmount,
      tax_amount
    ),
    training_fund_employee_amount = COALESCE(
      $trainingFundEmployeeAmount,
      training_fund_employee_amount
    ),
    training_fund_employee_percentage = COALESCE(
      $trainingFundEmployeePercentage,
      training_fund_employee_percentage
    ),
    training_fund_employer_amount = COALESCE(
      $trainingFundEmployerAmount,
      training_fund_employer_amount
    ),
    training_fund_employer_percentage = COALESCE(
      $trainingFundEmployerPercentage,
      training_fund_employer_percentage
    ),
    training_fund_id = COALESCE(
      $trainingFundId,
      training_fund_id
    ),
    vacation_days_balance = COALESCE(
      $vacationDaysBalance,
      vacation_days_balance
    ),
    vacation_takeout = COALESCE(
      $vacationTakeout,
      vacation_takeout
    ),
    work_days = COALESCE(
      $workDays,
      work_days
    ),
    zkufot = COALESCE(
      $zkufot,
      zkufot
    )
  WHERE month = $month AND employee_id = $employeeId
  RETURNING *;
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

  public getAllTags() {
    return getAllSalaryRecords.run(undefined, this.dbProvider);
  }

  private async batchGetSalaryRecordsByChargeIds(chargeIds: stringArray) {
    const salaries = await getSalaryRecordsByChargeIds.run({ chargeIds }, this.dbProvider);
    return chargeIds.map(id => salaries.filter(record => record.charge_id === id));
  }

  public getSalaryRecordsByChargeIdLoader = new DataLoader(
    (chargeIds: readonly string[]) =>
      this.batchGetSalaryRecordsByChargeIds(chargeIds as stringArray),
    { cache: false },
  );

  public insertSalaryRecords(params: IInsertSalaryRecordsParams) {
    return insertSalaryRecords.run(params, this.dbProvider);
  }

  public updateSalaryRecord(params: IUpdateSalaryRecordParams) {
    return updateSalaryRecord.run(params, this.dbProvider);
  }
}
