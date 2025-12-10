import { differenceInYears, endOfDay, endOfMonth, endOfYear } from 'date-fns';
import { GraphQLError } from 'graphql';
import { AVERAGE_MONTHLY_WORK_HOURS } from '../../../shared/constants.js';
import { EmployeesProvider } from '../../salaries/providers/employees.provider.js';
import { RecoveryProvider } from '../../salaries/providers/recovery.provider.js';
import { SalariesProvider } from '../../salaries/providers/salaries.provider.js';
import type {
  IGetEmployeesByEmployerResult,
  IGetSalaryRecordsByDatesResult,
} from '../../salaries/types.js';
import { LedgerProvider } from '../providers/ledger.provider.js';

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

// returns the parts of the month that the employee worked, first is pre-anniversary
function calculateMonthPart(
  year: number,
  month: number,
  startDate: Date,
  endDate: Date | null,
): [number, number] {
  const isAnniversaryMonth = startDate.getMonth() + 1;
  const isTerminationMonth =
    endDate && endDate.getFullYear() === year && endDate.getMonth() + 1 === month;
  if (isAnniversaryMonth) {
    if (isTerminationMonth) {
      // case both anniversary month and termination month
      const isPreAnniversaryTermination = endDate.getDate() < startDate.getDate();
      const tillTerminationPart = (endDate.getDate() - 1) / endOfMonth(endDate).getDate();
      if (isPreAnniversaryTermination) {
        return [tillTerminationPart, 0];
      }

      const inBetweenPart =
        (endDate.getDate() - startDate.getDate()) / endOfMonth(endDate).getDate();
      return [tillTerminationPart - inBetweenPart, inBetweenPart];
    }

    const part1 = (startDate.getDate() - 1) / endOfMonth(startDate).getDate();
    return [part1, 1 - part1];
  }
  if (isTerminationMonth) {
    const part1 = (endDate.getDate() - 1) / endOfMonth(endDate).getDate();
    return [part1, 0];
  }

  // TODO: calculate working days / unpaid leave days / any other relevant factor

  return [1, 0];
}

export async function calculateRecoveryReserveAmount(
  context: GraphQLModules.Context,
  year: number,
) {
  const {
    injector,
    adminContext: {
      defaultAdminBusinessId,
      salaries: { recoveryReserveExpensesTaxCategoryId, recoveryReserveTaxCategoryId },
    },
  } = context;
  if (!recoveryReserveExpensesTaxCategoryId) {
    throw new GraphQLError('Recovery reserve expenses tax category is not set');
  }
  if (!recoveryReserveTaxCategoryId) {
    throw new GraphQLError('Recovery reserve tax category is not set');
  }

  const salariesPromise = injector
    .get(SalariesProvider)
    .getSalaryRecordsByDates({ fromDate: '2000-01', toDate: `${year}-12` });
  const employeesPromise = injector
    .get(EmployeesProvider)
    .getEmployeesByEmployerLoader.load(defaultAdminBusinessId);
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
  const recoveryLedgerRecordsPromise = injector
    .get(LedgerProvider)
    .getLedgerRecordsByFinancialEntityIdLoader.load(recoveryReserveTaxCategoryId);
  const [salaries, employees, recoveryDayValueByYear, recoveryLedgerRecords] = await Promise.all([
    salariesPromise,
    employeesPromise,
    recoveryDataPromise,
    recoveryLedgerRecordsPromise,
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

    const yearForRecoveryValue = month >= 7 ? year + 1 : year;

    let dayValue = recoveryDayValueByYear.get(yearForRecoveryValue);
    // in case of no recovery day value for the year, try to get it from the previous year (yearly value is published in delay)
    if (!dayValue && yearForRecoveryValue >= new Date().getFullYear()) {
      dayValue = recoveryDayValueByYear.get(year);
    }
    if (!dayValue) {
      throw new GraphQLError(`No recovery day value for year ${yearForRecoveryValue}`);
    }

    const isAnniversaryMonth = employee.startDate.getMonth() + 1 === month;
    const isLastSalary =
      employee.endDate &&
      employee.endDate.getFullYear() === year &&
      employee.endDate.getMonth() + 1 === month;
    const isHourlyPayed =
      Number.isNaN(Number(salaryRecord.job_percentage)) ||
      Number(salaryRecord.job_percentage) === 0;
    const shouldCalculateMonthParts = (isAnniversaryMonth || isLastSalary) && !isHourlyPayed;
    const monthParts = shouldCalculateMonthParts
      ? calculateMonthPart(year, month, employee.startDate, employee.endDate)
      : [1, 0];

    const yearsWorked =
      differenceInYears(endOfMonth(new Date(`${year}-${month}-01`)), employee.startDate) +
      (isAnniversaryMonth && !isHourlyPayed ? 0 : 1);
    const recoveryDays = recoveryDaysPerYearsOfExperience(yearsWorked) / 12;
    const jobPercentage = isHourlyPayed
      ? Number(salaryRecord.hours) / AVERAGE_MONTHLY_WORK_HOURS
      : Number(salaryRecord.job_percentage) / 100;

    employee.totalRecoveryAmount += recoveryDays * monthParts[0] * jobPercentage * dayValue;

    if (isAnniversaryMonth && !isHourlyPayed) {
      const recoveryDays = recoveryDaysPerYearsOfExperience(yearsWorked + 1) / 12;
      employee.totalRecoveryAmount += recoveryDays * monthParts[1] * jobPercentage * dayValue;
    }

    employee.salaries[year] ??= {};
    employee.salaries[year][month] = salaryRecord;

    if (salaryRecord.recovery) {
      employee.payedRecoveryAmount += Number(salaryRecord.recovery);
    }
  }

  let recoveryReserveAmount = 0;

  let reservePrompt = `Recovery reserve for ${year}:`;
  for (const employeeData of Array.from(employeeMap.values())) {
    const employeeReserve = employeeData.totalRecoveryAmount - employeeData.payedRecoveryAmount;
    reservePrompt += `\n- Employee ${employeeData.employee.first_name} reserve: ${employeeReserve}`;
    recoveryReserveAmount += employeeReserve;
  }

  const prevRecoveryReserveAmount = recoveryLedgerRecords.reduce((acc, record) => {
    if (endOfDay(record.value_date).getTime() >= new Date(year, 11, 31).getTime()) {
      return acc;
    }
    let factor = 0;
    if (
      record.credit_entity1 === recoveryReserveTaxCategoryId ||
      record.debit_entity1 === recoveryReserveExpensesTaxCategoryId
    ) {
      factor = 1;
    } else if (
      record.credit_entity1 === recoveryReserveExpensesTaxCategoryId ||
      record.debit_entity1 === recoveryReserveTaxCategoryId
    ) {
      factor = -1;
    }
    return acc + Number(record.credit_local_amount1) * factor;
  }, 0);
  recoveryReserveAmount -= prevRecoveryReserveAmount;
  reservePrompt += `\n- Prev reserve: ${prevRecoveryReserveAmount}`;

  console.debug(reservePrompt);

  return { recoveryReserveAmount };
}
