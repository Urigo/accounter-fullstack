import { endOfMonth, endOfYear } from 'date-fns';
import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { EmployeesProvider } from '@modules/salaries/providers/employees.provider.js';
import { RecoveryProvider } from '@modules/salaries/providers/recovery.provider.js';
import { SalariesProvider } from '@modules/salaries/providers/salaries.provider.js';
import {
  IGetEmployeesByEmployerResult,
  IGetSalaryRecordsByDatesResult,
} from '@modules/salaries/types';
import { DEFAULT_FINANCIAL_ENTITY_ID } from '@shared/constants';

function recoveryDaysPerYearsOfExperience(years: number) {
  if (years === 1) {
    return 5;
  }
  if (years >= 2 && years <= 3) {
    return 6;
  }
  if (years >= 4 && years <= 10) {
    return 7;
  }
  if (years >= 11 && years <= 15) {
    return 8;
  }
  if (years >= 16 && years <= 19) {
    return 9;
  }
  if (years >= 20) {
    return 10;
  }
  return 0;
}

function calculateMonthPart(year: number, month: number, startDate: Date, endDate: Date | null) {
  if (startDate.getFullYear() === year && startDate.getMonth() === month - 1) {
    return 1 - (startDate.getDate() - 1) / endOfMonth(startDate).getDate();
  }
  if (endDate && endDate.getFullYear() === year && endDate.getMonth() === month - 1) {
    return (endDate.getDate() - 1) / endOfMonth(endDate).getDate();
  }

  // TODO: calculate working days / unpaid leave days / any other relevant factor

  return 1;
}

export async function calculateRecoveryReservesAmount(injector: Injector, year: number) {
  const salariesPromise = injector
    .get(SalariesProvider)
    .getSalaryRecordsByDates({ fromDate: '2000-01', toDate: `${year}-12` });
  const employeesPromise = injector
    .get(EmployeesProvider)
    .getEmployeesByEmployerLoader.load(DEFAULT_FINANCIAL_ENTITY_ID);
  const recoveryDataPromise = injector
    .get(RecoveryProvider)
    .getRecoveryData()
    .then(data => {
      const recoveryDayValueByYear = new Map<number, number>();
      for (const record of data) {
        recoveryDayValueByYear.set(record.year, Number(record.day_value));
      }
      return recoveryDayValueByYear;
    });
  const [salaries, employees, recoveryDayValueByYear] = await Promise.all([
    salariesPromise,
    employeesPromise,
    recoveryDataPromise,
  ]);

  const employeeMap = new Map<
    string,
    {
      startDate: Date;
      endDate: Date | null;
      payedRecoveryAmount: number;
      totalRecoveryAmount: number;
      salaries: Record<number, Record<number, IGetSalaryRecordsByDatesResult>>;
      employee: IGetEmployeesByEmployerResult;
    }
  >();

  for (const employee of employees) {
    if (employee.start_work_date!.getFullYear() > year) {
      continue;
    }
    if (
      employee.end_work_date &&
      employee.end_work_date.getTime() < endOfYear(new Date(`${year}-01-01`)).getTime()
    ) {
      continue;
    }
    employeeMap.set(employee.business_id, {
      startDate: employee.start_work_date!,
      endDate: employee.end_work_date,
      salaries: {},
      payedRecoveryAmount: 0,
      totalRecoveryAmount: 0,
      employee,
    });
  }

  for (const salaryRecord of salaries) {
    // skip if employee is not found
    if (!employeeMap.has(salaryRecord.employee_id)) {
      continue;
    }
    const employee = employeeMap.get(salaryRecord.employee_id)!;
    // skip if salary record outside of employee's employment dates
    if (employee.startDate.getTime() > endOfMonth(new Date(`${salaryRecord.month}-01`)).getTime()) {
      console.log(
        `salary record of employee ${employee.employee.first_name} before start date - ${employee.startDate}`,
      );
      continue;
    }
    if (
      employee.endDate &&
      employee.endDate.getTime() < new Date(`${salaryRecord.month}-01`).getTime()
    ) {
      console.log(
        `salary record of employee ${employee.employee.first_name} after end date - ${employee.endDate}`,
      );
      continue;
    }

    const [yearString, monthString] = salaryRecord.month.split('-');

    // validate year
    const year = Number(yearString);
    if (Number.isNaN(year)) {
      throw new GraphQLError(`Year is not valid, got ${yearString}`);
    }
    if (year < 2000) {
      throw new GraphQLError(`Year is below coverage limit (2000), got ${yearString}`);
    }

    // validate month
    const month = Number(monthString);
    if (Number.isNaN(month) || month < 1 || month > 12) {
      throw new GraphQLError(`Month is not valid, got ${monthString}`);
    }

    const dayValue = recoveryDayValueByYear.get(year);
    if (!dayValue) {
      throw new GraphQLError(`No recovery day value for year ${year}`);
    }

    const yearsWorked = year - employee.startDate.getFullYear() + 1;
    const recoveryDays = recoveryDaysPerYearsOfExperience(yearsWorked) / 12;
    const monthPart = calculateMonthPart(year, month, employee.startDate, employee.endDate); // TODO: calculate month part
    const jobPercentage = 1; // TODO: calculate job percentage

    employee.totalRecoveryAmount += recoveryDays * monthPart * jobPercentage * dayValue;

    employee.salaries[year] ??= {};
    employee.salaries[year][month] = salaryRecord;

    if (salaryRecord.recovery) {
      employee.payedRecoveryAmount += Number(salaryRecord.recovery);
    }
  }

  let recoveryReservesAmount = 0;

  let reservesPrompt = `Recovery reserves for ${year}:`;
  for (const employeeData of Array.from(employeeMap.values())) {
    const employeeReserve = employeeData.totalRecoveryAmount - employeeData.payedRecoveryAmount;
    reservesPrompt += `\n- Employee ${employeeData.employee.first_name} reserve: ${employeeReserve}`;
    recoveryReservesAmount += employeeReserve;
  }
  console.debug(reservesPrompt);

  return { recoveryReservesAmount };
}
