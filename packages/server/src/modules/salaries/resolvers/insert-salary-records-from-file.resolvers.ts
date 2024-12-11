import { GraphQLError } from 'graphql';
import xlsx from 'node-xlsx';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { EmployeesProvider } from '../providers/employees.provider.js';
import { FundsProvider } from '../providers/funds.provider.js';
import { SalariesProvider } from '../providers/salaries.provider.js';
import type { IInsertSalaryRecordsParams, SalariesModule } from '../types.js';

export class SalaryError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function getFormattedSalaryMonth(rawDate: string) {
  const dateParts = rawDate.split('/');
  return `${dateParts[1]}-${dateParts[0]}`;
}

function getEmployeeIdsFromSheet(dataArray: unknown[]): Array<[string, number]> {
  return dataArray
    .map((data, index) => [data, index] as [string | null | undefined, number])
    .filter(([data, index]) => {
      if (index < 2) return false;
      if (!data || data === '') return false;
      return true;
    }) as Array<[string, number]>;
}

function normalizeNationalId(nationalId: number): string {
  const stringNationalId = nationalId.toString();
  return stringNationalId.length === 9
    ? stringNationalId
    : '0'.repeat(9 - stringNationalId.length) + stringNationalId;
}

function validateGenericSalaryData(
  salaryData: ReturnType<typeof xlsx.parse<unknown[]>>[number]['data'] | undefined,
): ReturnType<typeof xlsx.parse<unknown[]>>[number]['data'] {
  if (!salaryData) {
    throw new SalaryError('Missing salary data sheet');
  }
  return salaryData;
}

function validateRowByCategory(
  data: ReturnType<typeof xlsx.parse<unknown[]>>[number]['data'],
  category: string,
): { row: unknown[]; rowNum: number } {
  const rowNum = data.findIndex(row => Array.isArray(row) && row[1] === category);
  if (!data[rowNum]) {
    throw new SalaryError(`Missing ${category} in row ${rowNum + 1}`);
  }
  if (!Array.isArray(data[rowNum])) {
    throw new SalaryError(`Invalid row for ${category} in row ${rowNum + 1}`);
  }
  if (!data[rowNum][1] || data[rowNum][1] !== category) {
    throw new SalaryError(`Invalid category for ${category} in row ${rowNum + 1}`);
  }
  return { row: data[rowNum], rowNum };
}

function validateColumn(
  row: unknown[],
  columnNum: number,
  category: string,
  rowNum: number,
  nullable = false,
): { cell: unknown; colLetter: string } {
  const columns = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (!nullable && !row[columnNum]) {
    throw new SalaryError(
      `Missing column ${columns[columnNum]} for ${category} in row ${rowNum + 1}`,
    );
  }

  return { cell: row[columnNum], colLetter: columns[columnNum] };
}

function validateCell(
  salaryData: ReturnType<typeof xlsx.parse<unknown[]>>[number]['data'] | undefined,
  category: string,
  columnNum: number,
  nullable = false,
): { cell: unknown; colLetter: string; rowNum: number } {
  const data = validateGenericSalaryData(salaryData);
  const { row, rowNum } = validateRowByCategory(data, category);
  const { cell, colLetter } = validateColumn(row, columnNum, category, rowNum, nullable);
  return { cell, colLetter, rowNum };
}

function validateNumericCell(
  salaryData: ReturnType<typeof xlsx.parse<unknown[]>>[number]['data'] | undefined,
  category: string,
  columnNum: number,
  nullable = false,
): number {
  const { cell, colLetter, rowNum } = validateCell(salaryData, category, columnNum, nullable);
  if (typeof cell !== 'number') {
    throw new SalaryError(`Invalid ${category} in row ${rowNum + 1}, column ${colLetter}: ${cell}`);
  }
  return cell;
}

export const insertSalaryRecordsFromFile: SalariesModule.MutationResolvers['insertSalaryRecordsFromFile'] =
  async (_, { file, chargeId }, { injector, currentUser }) => {
    try {
      const buffer = await file.arrayBuffer();
      const workSheetsFromFile = xlsx.parse(buffer);
      if (!workSheetsFromFile) {
        throw new SalaryError('No salary data file found');
      }
      const salaryData = workSheetsFromFile.find(sheet => sheet.name === 'ריכוז נתוני שכר')?.data;
      if (!salaryData) {
        throw new SalaryError('No salary data sheet found in file');
      }

      const rawSalaryMonth = salaryData[1][3];
      const salaryMonth = getFormattedSalaryMonth(rawSalaryMonth);

      const { row: employeesRow } = validateRowByCategory(salaryData, 'מספר זהות');
      const employeesNationalIds = getEmployeeIdsFromSheet(employeesRow);

      const allEmployeesPromise = injector
        .get(EmployeesProvider)
        .getEmployeesByEmployerLoader.load(currentUser.userId)
        .catch(e => {
          console.error(e);
          throw new SalaryError('Failed to get employees for employer');
        });

      const salaryChargePromise = chargeId
        ? Promise.resolve(chargeId)
        : injector
            .get(ChargesProvider)
            .generateCharge({
              type: 'PAYROLL',
              ownerId: currentUser.userId,
              userDescription: `Salaries ${rawSalaryMonth}`,
            })
            .then(res => res[0].id)
            .catch(e => {
              console.error(e);
              throw new SalaryError('Failed to generate salary charge');
            });

      const allFundsPromise = injector.get(FundsProvider).getAllFunds();

      const [allEmployees, salaryChargeId, allFunds] = await Promise.all([
        allEmployeesPromise,
        salaryChargePromise,
        allFundsPromise,
      ]);

      const salaryRecords: Array<IInsertSalaryRecordsParams['salaryRecords'][0]> = [];

      for (const [nationalId, employeeColumn] of employeesNationalIds) {
        const employee = allEmployees.find(
          e => e.national_id === normalizeNationalId(Number(nationalId)),
        );
        if (!employee) {
          throw new SalaryError(`Employee with national id ${nationalId} not found`);
        }

        // eslint-disable-next-line no-inner-declarations
        function validateNumericCellWrapper(category: string, nullable?: boolean) {
          return validateNumericCell(salaryData, category, employeeColumn, nullable);
        }
        // eslint-disable-next-line no-inner-declarations
        function validateFund(category: string, nullable?: boolean) {
          const data = validateGenericSalaryData(salaryData);
          const { rowNum: prevRowNum } = validateRowByCategory(data, category);
          const rowNum = prevRowNum + 1;
          const row = data[rowNum];
          if (!Array.isArray(row)) {
            throw new SalaryError(`Invalid row for ${category} in row ${rowNum + 2}`);
          }
          const { cell: fundKey, colLetter } = validateColumn(
            row,
            employeeColumn,
            category,
            rowNum,
            nullable,
          );
          if (typeof fundKey !== 'number') {
            throw new SalaryError(
              `Invalid ${category} in row ${rowNum + 1}, column ${colLetter}: ${fundKey}`,
            );
          }
          const fundId = allFunds.find(f => Number(f.otsar_id) === fundKey)?.id;
          if (!fundId) {
            throw new SalaryError(`Fund with key ${fundKey} not found`);
          }
          return fundId;
        }

        const record: IInsertSalaryRecordsParams['salaryRecords'][number] = {
          month: salaryMonth,
          chargeId: salaryChargeId,
          employeeId: employee.business_id,
          employer: employee.employer,
          employee: employee.national_id,

          baseSalary: validateNumericCellWrapper('שכר יסוד'),
          globalAdditionalHours: validateNumericCellWrapper('שעות נוספות גלובליות', true),
          hourlyRate: validateNumericCellWrapper('Hourly rate', true),

          bonus: validateNumericCellWrapper('בונוס', true),
          gift: validateNumericCellWrapper('מתנות', true),
          recovery: validateNumericCellWrapper('הבראה', true),
          vacationTakeout: validateNumericCellWrapper('פדיון חופשה', true),
          zkufot:
            validateNumericCellWrapper('שווי קרן השתלמות', true) +
            validateNumericCellWrapper('שווי קיצבה', true),

          directPaymentAmount: validateNumericCellWrapper('נטו לתשלום'),

          socialSecurityAmountEmployee: validateNumericCellWrapper('ביטוח לאומי עובד'),
          socialSecurityAmountEmployer: validateNumericCellWrapper('ביטוח לאומי מעסיק'),
          healthPaymentAmount: validateNumericCellWrapper('דמי בריאות'),
          taxAmount: validateNumericCellWrapper('מס הכנסה'),

          trainingFundId: validateFund('קרן השתלמות'),
          trainingFundEmployeeAmount: validateNumericCellWrapper('ניכוי קה"ש עובד'),
          trainingFundEmployeePercentage: validateNumericCellWrapper('אחוז קה"ש עובד') * 100,
          trainingFundEmployerAmount: validateNumericCellWrapper('סכום קה"ש מעסיק'),
          trainingFundEmployerPercentage: validateNumericCellWrapper('אחוז קה"ש מעסיק') * 100,

          pensionFundId: validateFund('קרן פנסיה'),
          pensionEmployeeAmount: validateNumericCellWrapper('ניכוי פנסיה עובד'),
          pensionEmployeePercentage: validateNumericCellWrapper('אחוז פנסיה עובד') * 100,
          pensionEmployerAmount: validateNumericCellWrapper('סכום פנסיה מעסיק'),
          pensionEmployerPercentage: validateNumericCellWrapper('אחוז פנסיה מעסיק') * 100,
          compensationsEmployerAmount: validateNumericCellWrapper('סכום פיצויים'),
          compensationsEmployerPercentage: validateNumericCellWrapper('אחוז פיצויים') * 100,

          workDays: validateNumericCellWrapper('ימי עבודה'),
          hours: validateNumericCellWrapper('שעות עבודה'),
          jobPercentage: validateNumericCellWrapper('Job percentage') * 100,
          vacationDaysBalance: -1 * validateNumericCellWrapper('ניצול חופשה', true),
          sicknessDaysBalance: -1 * validateNumericCellWrapper('ניצול מחלה', true),

          // not currently in use:
          addedVacationDays: null,
        };
        salaryRecords.push(record);
      }

      await injector
        .get(SalariesProvider)
        .insertSalaryRecords({ salaryRecords })
        .catch(e => {
          console.error(e);
          throw new SalaryError('Failed to insert salary records from file');
        });
      return true;
    } catch (e) {
      if (e instanceof SalaryError) {
        throw new GraphQLError(e.message);
      }
      console.error(e);
      throw new GraphQLError('Failed to insert salary records from file');
    }
  };
