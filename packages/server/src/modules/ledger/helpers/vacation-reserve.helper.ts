import { differenceInDays, endOfMonth, endOfYear, startOfMonth } from 'date-fns';
import { GraphQLError } from 'graphql';
import { EmployeesProvider } from '../../../modules/salaries/providers/employees.provider.js';
import { SalariesProvider } from '../../../modules/salaries/providers/salaries.provider.js';
import type {
  IGetEmployeesByEmployerResult,
  IGetSalaryRecordsByDatesResult,
} from '../../../modules/salaries/types.js';
import {
  AVERAGE_MONTHLY_WORK_DAYS,
  AVERAGE_MONTHLY_WORK_HOURS,
} from '../../../shared/constants.js';
import { LedgerProvider } from '../providers/ledger.provider.js';

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

export async function calculateVacationReserveAmount(
  context: GraphQLModules.Context,
  year: number,
) {
  const {
    injector,
    adminContext: {
      defaultAdminBusinessId,
      salaries: { vacationReserveTaxCategoryId, vacationReserveExpensesTaxCategoryId },
    },
  } = context;
  if (!vacationReserveTaxCategoryId) {
    throw new GraphQLError(`Vacation reserves tax category is not set`);
  }
  if (!vacationReserveExpensesTaxCategoryId) {
    throw new GraphQLError(`Vacation reserves expenses tax category is not set`);
  }

  const salariesPromise = injector
    .get(SalariesProvider)
    .getSalaryRecordsByDates({ fromDate: '2000-01', toDate: `${year}-12` });
  const employeesPromise = injector
    .get(EmployeesProvider)
    .getEmployeesByEmployerLoader.load(defaultAdminBusinessId);
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
      vacationDays: number;
      startWorkDate: Date;
      firstSalary: IGetSalaryRecordsByDatesResult | null;
      latestSalary: IGetSalaryRecordsByDatesResult | null;
      salaries: IGetSalaryRecordsByDatesResult[];
      isHourly: boolean;
    }
  >();
  const yearEnd = endOfYear(new Date(`${year}-01-01`));

  for (const employee of employees) {
    if (employee.start_work_date!.getFullYear() > year) {
      continue;
    }
    if (employee.end_work_date && employee.end_work_date.getTime() < yearEnd.getTime()) {
      continue;
    }

    employeeMap.set(employee.business_id, {
      employee,
      vacationDays: 0,
      startWorkDate: employee.start_work_date,
      firstSalary: null,
      latestSalary: null,
      salaries: [],
      isHourly: false,
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

    if (!employee.firstSalary || salaryRecord.month < employee.firstSalary.month) {
      employee.firstSalary = salaryRecord;
    }

    if (!employee.latestSalary || salaryRecord.month > employee.latestSalary.month) {
      employee.latestSalary = salaryRecord;
    }

    if (salaryRecord.vacation_days_balance) {
      const daysExploit = Number(salaryRecord.vacation_days_balance);
      employee.vacationDays += daysExploit;
    }

    employee.salaries.push(salaryRecord);
  }

  let vacationReserveAmount = 0;

  let reservesPrompt = `Vacation reserve for ${year}:`;
  for (const employeeData of Array.from(employeeMap.values())) {
    if (!employeeData.latestSalary || !employeeData.firstSalary) {
      throw new GraphQLError(`Employee ${employeeData.employee.first_name} has no salary records`);
    }
    // calculate cumulative vacation days by seniority
    const isFirstSalaryHourly =
      Number.isNaN(Number(employeeData.firstSalary.job_percentage)) ||
      Number(employeeData.firstSalary.job_percentage) === 0;
    const formalEmployeeStartDate = employeeData.employee.start_work_date;
    const adjustedEmployeeStartDate = isFirstSalaryHourly
      ? startOfMonth(formalEmployeeStartDate)
      : formalEmployeeStartDate;
    const seniority = differenceInDays(yearEnd, adjustedEmployeeStartDate) / 365;
    const cumulativeVacationDays = vacationDaysPerYearsOfExperience(seniority);

    employeeData.vacationDays += cumulativeVacationDays;

    const averageJobPercentage =
      employeeData.salaries.reduce((accumulator, salary) => {
        let part = 0;
        if (!Number.isNaN(Number(salary.job_percentage)) && Number(salary.job_percentage) !== 0) {
          part = Number(salary.job_percentage) / 100;
        } else if (!Number.isNaN(Number(salary.hours)) && Number(salary.hours) !== 0) {
          part = Number(salary.hours) / AVERAGE_MONTHLY_WORK_HOURS;
        }
        return accumulator + part;
      }, 0) / employeeData.salaries.length;
    const vacationDaysByJobPercentage = employeeData.vacationDays * averageJobPercentage;

    const isLatestSalaryHourly =
      Number.isNaN(Number(employeeData.latestSalary.job_percentage)) ||
      Number(employeeData.latestSalary.job_percentage) === 0;
    const latestSalaryAmount = isLatestSalaryHourly
      ? Number(employeeData.latestSalary.hourly_rate) * AVERAGE_MONTHLY_WORK_HOURS
      : Number(employeeData.latestSalary.base_salary) +
        Number(employeeData.latestSalary.global_additional_hours);
    if (!latestSalaryAmount || Number.isNaN(latestSalaryAmount)) {
      throw new GraphQLError(
        `Employee ${employeeData.employee.first_name} has no valid salary amount for last month`,
      );
    }
    const dailySalary = latestSalaryAmount / AVERAGE_MONTHLY_WORK_DAYS;
    const employeeReserve = Math.round(vacationDaysByJobPercentage * dailySalary);
    reservesPrompt += `\n- Employee ${employeeData.employee.first_name} reserve: ${vacationDaysByJobPercentage} days; ${dailySalary.toFixed(2)} daily payment; ${employeeReserve}`;
    vacationReserveAmount += employeeReserve;
  }

  const prevVacationReserveAmount = vacationLedgerRecords.reduce((acc, record) => {
    let factor = 0;
    if (record.value_date.getTime() >= new Date(year, 11, 31).getTime()) {
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
  reservesPrompt += `\n- Prev reserve: ${prevVacationReserveAmount}`;
  vacationReserveAmount -= prevVacationReserveAmount;

  console.debug(reservesPrompt);

  return { vacationReserveAmount };
}
