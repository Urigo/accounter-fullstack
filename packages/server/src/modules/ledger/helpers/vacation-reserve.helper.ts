import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { AVERAGE_MONTHLY_WORK_DAYS } from '../../../shared/constants.js';
import {
  endOfTimelessMonth,
  endOfTimelessYear,
  getTimelessDateYear,
} from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { EmployeesProvider } from '../../salaries/providers/employees.provider.js';
import { SalariesProvider } from '../../salaries/providers/salaries.provider.js';
import type {
  IGetEmployeesByEmployerResult,
  IGetSalaryRecordsByDatesResult,
} from '../../salaries/types.js';
import { LedgerProvider } from '../providers/ledger.provider.js';

export async function calculateVacationReserveAmount(injector: Injector, year: number) {
  const {
    ownerId,
    salaries: { vacationReserveTaxCategoryId, vacationReserveExpensesTaxCategoryId },
  } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
  if (!vacationReserveTaxCategoryId) {
    throw new GraphQLError(`Vacation reserves tax category is not set`);
  }
  if (!vacationReserveExpensesTaxCategoryId) {
    throw new GraphQLError(`Vacation reserves expenses tax category is not set`);
  }

  const salariesPromise = injector
    .get(SalariesProvider)
    .getSalaryRecordsByDates({ fromDate: `${year}-01`, toDate: `${year}-12` });
  const employeesPromise = injector
    .get(EmployeesProvider)
    .getEmployeesByEmployerLoader.load(ownerId);
  const vacationLedgerRecordsPromise = injector
    .get(LedgerProvider)
    .getLedgerRecordsByFinancialEntityIdLoader.load(vacationReserveTaxCategoryId);
  const [salaries, employees, vacationLedgerRecords] = await Promise.all([
    salariesPromise,
    employeesPromise,
    vacationLedgerRecordsPromise,
  ]);

  const employeeMap = new Map<
    string,
    {
      employee: IGetEmployeesByEmployerResult;
      latestSalary: IGetSalaryRecordsByDatesResult | null;
    }
  >();
  const yearEnd = endOfTimelessYear(year);

  // employees who left by year-end are excluded: their reserve is released through the delta
  for (const employee of employees) {
    if (getTimelessDateYear(employee.start_work_date!) > year) {
      continue;
    }
    if (employee.end_work_date && employee.end_work_date <= yearEnd) {
      continue;
    }

    employeeMap.set(employee.business_id, { employee, latestSalary: null });
  }

  for (const salaryRecord of salaries) {
    // skip if employee is not found
    if (!employeeMap.has(salaryRecord.employee_id)) {
      continue;
    }
    const employee = employeeMap.get(salaryRecord.employee_id)!;
    // skip if salary record outside of employee's employment dates
    const salaryMonthStart = `${salaryRecord.month}-01` as TimelessDateString;
    if (employee.employee.start_work_date > endOfTimelessMonth(salaryMonthStart)) {
      continue;
    }
    if (employee.employee.end_work_date && employee.employee.end_work_date < salaryMonthStart) {
      continue;
    }

    if (!employee.latestSalary || salaryRecord.month > employee.latestSalary.month) {
      employee.latestSalary = salaryRecord;
    }
  }

  let vacationReserveAmount = 0;
  const employeesWithoutBalance: string[] = [];

  for (const { employee, latestSalary } of employeeMap.values()) {
    if (!latestSalary) {
      throw new GraphQLError(`Employee ${employee.business_id} has no salary records in ${year}`);
    }
    // the year-end payslip balance is the number of unused vacation days
    if (latestSalary.vacation_days_balance == null || latestSalary.vacation_days_balance === '') {
      employeesWithoutBalance.push(employee.business_id);
      continue;
    }
    const vacationDays = Number(latestSalary.vacation_days_balance);

    // part-time is applied once, through the actual monthly pay
    const isHourly =
      Number.isNaN(Number(latestSalary.job_percentage)) ||
      Number(latestSalary.job_percentage) === 0;
    const monthlyPay = isHourly
      ? Number(latestSalary.hourly_rate) * Number(latestSalary.hours)
      : Number(latestSalary.base_salary) + Number(latestSalary.global_additional_hours);
    if (!monthlyPay || Number.isNaN(monthlyPay)) {
      throw new GraphQLError(
        `Employee ${employee.business_id} has no valid salary amount for last month`,
      );
    }
    const dailySalary = monthlyPay / AVERAGE_MONTHLY_WORK_DAYS;
    vacationReserveAmount += Math.round(vacationDays * dailySalary);
  }

  if (employeesWithoutBalance.length) {
    throw new GraphQLError(
      `Missing ${year} year-end vacation days balance for employees: ${employeesWithoutBalance.join(', ')}`,
    );
  }

  const prevVacationReserveAmount = vacationLedgerRecords.reduce((acc, record) => {
    let factor = 0;
    if (record.value_date >= yearEnd) {
      return acc;
    }
    if (
      record.credit_entity1 === vacationReserveTaxCategoryId ||
      record.debit_entity1 === vacationReserveExpensesTaxCategoryId
    ) {
      factor = 1;
    } else if (
      record.credit_entity1 === vacationReserveExpensesTaxCategoryId ||
      record.debit_entity1 === vacationReserveTaxCategoryId
    ) {
      factor = -1;
    }
    return acc + Number(record.credit_local_amount1) * factor;
  }, 0);
  vacationReserveAmount -= prevVacationReserveAmount;

  return { vacationReserveAmount };
}
