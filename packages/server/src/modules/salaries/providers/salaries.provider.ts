import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IGetAllSalaryRecordsQuery,
  IGetAllSalaryRecordsResult,
  IGetSalaryRecordsByChargeIdsQuery,
  IGetSalaryRecordsByDatesParams,
  IGetSalaryRecordsByDatesQuery,
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

const getSalaryRecordsByDates = sql<IGetSalaryRecordsByDatesQuery>`
    SELECT *
    FROM accounter_schema.salaries
    WHERE month >= $fromDate
      AND month <= $toDate;`;

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
    employee,
    employee_id,
    employer,
    gift,
    global_additional_hours,
    health_payment_amount,
    hourly_rate,
    hours,
    job_percentage,
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
    travel_and_subsistence,
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
    employee,
    employeeId,
    employer,
    gift,
    globalAdditionalHours,
    healthPaymentAmount,
    hourlyRate,
    hours,
    jobPercentage,
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
    travelAndSubsistence,
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
    job_percentage = COALESCE(
      $jobPercentage,
      job_percentage
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
    travel_and_subsistence = COALESCE(
      $travelAndSubsistence,
      travel_and_subsistence
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
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchSalaryRecordsByMonths(months: readonly string[]) {
    if (months.length === 1) {
      return [await getSalaryRecordsByMonth.run({ month: months[0] }, this.dbProvider)];
    }
    const sortedMonths = [...months].sort();
    const salaries = await getSalaryRecordsByDates.run(
      { fromDate: sortedMonths[0], toDate: sortedMonths[sortedMonths.length - 1] },
      this.dbProvider,
    );
    return months.map(month => salaries.filter(record => record.month === month));
  }

  public getSalaryRecordsByMonthLoader = new DataLoader(
    (months: readonly string[]) => this.batchSalaryRecordsByMonths(months),
    {
      cacheKeyFn: key => `salary-month-${key}`,
      cacheMap: this.cache,
    },
  );

  public getSalaryRecordsByDates(params: IGetSalaryRecordsByDatesParams) {
    return getSalaryRecordsByDates.run(params, this.dbProvider);
  }

  private async batchGetSalaryRecordsByChargeIds(chargeIds: stringArray) {
    const salaries = await getSalaryRecordsByChargeIds.run({ chargeIds }, this.dbProvider);
    return chargeIds.map(id => salaries.filter(record => record.charge_id === id));
  }

  public getSalaryRecordsByChargeIdLoader = new DataLoader(
    (chargeIds: readonly string[]) =>
      this.batchGetSalaryRecordsByChargeIds(chargeIds as stringArray),
    {
      cacheKeyFn: key => `salary-charge-${key}`,
      cacheMap: this.cache,
    },
  );

  public getAllSalaryRecords() {
    const cached = this.cache.get<IGetAllSalaryRecordsResult[]>('all-salaries');
    if (cached) {
      return Promise.resolve(cached);
    }
    return getAllSalaryRecords.run(undefined, this.dbProvider).then(res => {
      if (res) this.cache.set('all-salaries', res);
      return res;
    });
  }

  public insertSalaryRecords(params: IInsertSalaryRecordsParams) {
    this.clearCache();
    return insertSalaryRecords.run(params, this.dbProvider);
  }

  public updateSalaryRecord(params: IUpdateSalaryRecordParams) {
    this.clearCache();
    return updateSalaryRecord.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
