import { differenceInDays, endOfMonth, endOfYear } from 'date-fns';
import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { EmployeesProvider } from '@modules/salaries/providers/employees.provider.js';
import { SalariesProvider } from '@modules/salaries/providers/salaries.provider.js';
import {
  IGetEmployeesByEmployerResult,
  IGetSalaryRecordsByDatesResult,
} from '@modules/salaries/types';
import { AVERAGE_MONTHLY_WORK_DAYS, DEFAULT_FINANCIAL_ENTITY_ID } from '@shared/constants';

function roundHalf(n: number) {
  return Math.round(n * 2) / 2;
}

function vacationDaysPerYearsOfExperience(years: number) {
  if (years >= 0 && years <= 5) {
    return roundHalf(years * 12);
  }
  const firstFiveYearsVacationDays = 5 * 12;
  if (years >= 6 && years <= 8) {
    const remainingYearsVacationDays = (years - 5) * 17;
    return roundHalf(firstFiveYearsVacationDays + remainingYearsVacationDays);
  }
  if (years >= 9) {
    const nextThreeYearsVacationDays = 3 * 17;
    const remainingYearsVacationDays = (years - 8) * 23;
    return roundHalf(
      firstFiveYearsVacationDays + nextThreeYearsVacationDays + remainingYearsVacationDays,
    );
  }
  return 0;
}

export async function calculateVacationReserveAmount(injector: Injector, year: number) {
  const salariesPromise = injector
    .get(SalariesProvider)
    .getSalaryRecordsByDates({ fromDate: '2000-01', toDate: `${year}-12` });
  const employeesPromise = injector
    .get(EmployeesProvider)
    .getEmployeesByEmployerLoader.load(DEFAULT_FINANCIAL_ENTITY_ID);
  const [salaries, employees] = await Promise.all([salariesPromise, employeesPromise]);

  const employeeMap = new Map<
    string,
    {
      employee: IGetEmployeesByEmployerResult;
      vacationDays: number;
      latestSalary: IGetSalaryRecordsByDatesResult | null;
      latestSalaryAmount: number | null;
      salaries: Record<number, Record<number, IGetSalaryRecordsByDatesResult>>;
    }
  >();

  for (const employee of employees) {
    if (employee.start_work_date!.getFullYear() > year) {
      continue;
    }
    const yearEnd = endOfYear(new Date(`${year}-01-01`));
    if (employee.end_work_date && employee.end_work_date.getTime() < yearEnd.getTime()) {
      continue;
    }

    const seniority = differenceInDays(yearEnd, employee.start_work_date) / 365;
    const cumulativeVacationDays = vacationDaysPerYearsOfExperience(seniority);

    employeeMap.set(employee.business_id, {
      employee,
      vacationDays: cumulativeVacationDays,
      latestSalary: null,
      latestSalaryAmount: null,
      salaries: {},
    });
  }

  for (const salaryRecord of salaries) {
    // skip if employee is not found
    if (!employeeMap.has(salaryRecord.employee_id)) {
      continue;
    }
    const employee = employeeMap.get(salaryRecord.employee_id)!;
    // skip if salary record outside of employee's employment dates
    if (
      employee.employee.start_work_date.getTime() >
      endOfMonth(new Date(`${salaryRecord.month}-01`)).getTime()
    ) {
      console.log(
        `salary record of employee ${employee.employee.first_name} before start date - ${employee.employee.start_work_date}`,
      );
      continue;
    }
    if (
      employee.employee.end_work_date &&
      employee.employee.end_work_date.getTime() < new Date(`${salaryRecord.month}-01`).getTime()
    ) {
      console.log(
        `salary record of employee ${employee.employee.first_name} after end date - ${employee.employee.end_work_date}`,
      );
      continue;
    }

    if (
      salaryRecord.base_salary &&
      (!employee.latestSalary || salaryRecord.month > employee.latestSalary.month)
    ) {
      employee.latestSalary = salaryRecord;
      employee.latestSalaryAmount = Number(salaryRecord.base_salary);
    }

    if (salaryRecord.vacation_days_balance) {
      const daysExploit = Number(salaryRecord.vacation_days_balance);
      employee.vacationDays += daysExploit;
    }
  }

  let vacationReserveAmount = 0;

  let reservesPrompt = `Vacation reserve for ${year}:`;
  for (const employeeData of Array.from(employeeMap.values())) {
    if (!employeeData.latestSalaryAmount) {
      throw new GraphQLError(`Employee ${employeeData.employee.first_name} has no salary records`);
    }
    const partMonth = 1; // TODO: calculate part month
    const dailySalary = (employeeData.latestSalaryAmount * partMonth) / AVERAGE_MONTHLY_WORK_DAYS;
    const employeeReserve = Math.round(employeeData.vacationDays * dailySalary);
    reservesPrompt += `\n- Employee ${employeeData.employee.first_name} reserve: ${employeeData.vacationDays} days; ${dailySalary.toFixed(2)} daily payment; ${employeeReserve}`;
    vacationReserveAmount += employeeReserve;
  }
  console.debug(reservesPrompt);

  return { vacationReserveAmount };
}
