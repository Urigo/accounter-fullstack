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

function parseVacationDaysBalance(balance: string | null): number | null {
  if (balance == null || balance.trim() === '') {
    return null;
  }
  const days = Number(balance);
  return Number.isNaN(days) ? null : days;
}

function isHourlySalary(salary: IGetSalaryRecordsByDatesResult): boolean {
  const jobPercentage = Number(salary.job_percentage);
  return Number.isNaN(jobPercentage) || jobPercentage === 0;
}

// Average monthly hours over the year's hourly salary records. The hourly daily wage is scaled by
// it, so part-time hourly work is applied once, in the wage.
function averageMonthlyHours(salaries: IGetSalaryRecordsByDatesResult[]): number {
  const hours = salaries
    .filter(isHourlySalary)
    .map(salary => Number(salary.hours))
    .filter(value => !Number.isNaN(value) && value > 0);
  if (!hours.length) {
    return 0;
  }
  return hours.reduce((sum, value) => sum + value, 0) / hours.length;
}

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
      salaries: IGetSalaryRecordsByDatesResult[];
    }
  >();
  const yearEnd = endOfTimelessYear(year);

  // Only employees still employed at year-end carry a reserve. Leavers are excluded, so their
  // reserve from prior years is released through the delta below.
  for (const employee of employees) {
    if (getTimelessDateYear(employee.start_work_date!) > year) {
      continue;
    }
    if (employee.end_work_date && employee.end_work_date <= yearEnd) {
      continue;
    }

    employeeMap.set(employee.business_id, {
      employee,
      latestSalary: null,
      salaries: [],
    });
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

    employee.salaries.push(salaryRecord);
  }

  const employeesWithoutSalaries: string[] = [];
  const employeesWithoutBalance: string[] = [];
  for (const { employee, latestSalary } of employeeMap.values()) {
    if (!latestSalary) {
      employeesWithoutSalaries.push(employee.business_id);
    } else if (parseVacationDaysBalance(latestSalary.vacation_days_balance) === null) {
      employeesWithoutBalance.push(employee.business_id);
    }
  }
  if (employeesWithoutSalaries.length) {
    throw new GraphQLError(
      `Employees with no salary records in ${year}: ${employeesWithoutSalaries.join(', ')}`,
    );
  }
  if (employeesWithoutBalance.length) {
    throw new GraphQLError(
      `Missing ${year} year-end vacation days balance for employees: ${employeesWithoutBalance.join(', ')}`,
    );
  }

  let vacationReserveAmount = 0;

  for (const employeeData of employeeMap.values()) {
    const latestSalary = employeeData.latestSalary!;
    // The year-end payslip balance is the authoritative count of unused vacation days, in the
    // employee's own working days. Part-time work is reflected in the daily wage, not here.
    const vacationDays = parseVacationDaysBalance(latestSalary.vacation_days_balance)!;

    const dailySalary = isHourlySalary(latestSalary)
      ? (Number(latestSalary.hourly_rate) * averageMonthlyHours(employeeData.salaries)) /
        AVERAGE_MONTHLY_WORK_DAYS
      : (Number(latestSalary.base_salary) + Number(latestSalary.global_additional_hours ?? 0)) /
        AVERAGE_MONTHLY_WORK_DAYS;
    if (!dailySalary || Number.isNaN(dailySalary)) {
      throw new GraphQLError(
        `Employee ${employeeData.employee.business_id} has no valid salary amount for last month`,
      );
    }

    const employeeReserve = Math.round(vacationDays * dailySalary);
    vacationReserveAmount += employeeReserve;
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
