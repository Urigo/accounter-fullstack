import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { Resolvers } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import { SalariesProvider } from '../providers/salaries.provider.js';
import type { SalariesModule } from '../types.js';
import { insertSalaryRecordsFromFile } from './insert-salary-records-from-file.resolvers.js';
import { insertSalaryRecords } from './insert-salary.resolver.js';
import { updateSalaryRecord } from './update-salary.resolver.js';

export const salariesResolvers: SalariesModule.Resolvers &
  Pick<Resolvers, 'UpdateSalaryRecordResult' | 'InsertSalaryRecordsResult'> = {
  Query: {
    salaryRecordsByCharge: async (_, { chargeId }, { injector }) => {
      const salaryRecords = await injector
        .get(SalariesProvider)
        .getSalaryRecordsByChargeIdLoader.load(chargeId);
      return salaryRecords;
    },
    salaryRecordsByDates: async (_, { fromDate, toDate, employeeIDs }, { injector }) => {
      const fromDateMonth = fromDate.slice(0, 7);
      const toDateMonth = toDate.slice(0, 7);
      try {
        const salaryRecords = await injector
          .get(SalariesProvider)
          .getSalaryRecordsByDates({ fromDate: fromDateMonth, toDate: toDateMonth });
        return salaryRecords
          .filter(record => (employeeIDs ? employeeIDs.includes(record.employee_id) : true))
          .sort((a, b) => a.month.localeCompare(b.month));
      } catch (e) {
        throw new GraphQLError(`Failed to get salary records by dates: ${(e as Error).message}`);
      }
    },
  },
  Mutation: {
    insertSalaryRecords,
    updateSalaryRecord,
    insertOrUpdateSalaryRecords: async (_, params, { injector }) => {
      try {
        const recordsPromises = params.salaryRecords.map(async salaryRecord => {
          try {
            const res = await injector.get(SalariesProvider).updateSalaryRecord(salaryRecord);
            if (res.length !== 1) {
              throw new Error('Failed to update salary record');
            }
            return res[0];
          } catch (e) {
            const message = `Failed to update salary record of employee ID=${salaryRecord.employeeId} on month ${salaryRecord.month}`;
            console.error(`${message}: ${e}`);
          }

          try {
            const salaryRecords = params.salaryRecords.map(salaryRecord => ({
              ...salaryRecord,
              employee: salaryRecord.employee ?? null,
              addedVacationDays: salaryRecord.addedVacationDays ?? null,
              baseSalary: salaryRecord.baseSalary ?? null,
              bonus: salaryRecord.bonus ?? null,
              chargeId: salaryRecord.chargeId ?? null,
              compensationsEmployerAmount: salaryRecord.compensationsEmployerAmount ?? null,
              compensationsEmployerPercentage: salaryRecord.compensationsEmployerPercentage ?? null,
              gift: salaryRecord.gift ?? null,
              globalAdditionalHours: salaryRecord.globalAdditionalHours ?? null,
              healthPaymentAmount: salaryRecord.healthPaymentAmount ?? null,
              hourlyRate: salaryRecord.hourlyRate ?? null,
              hours: salaryRecord.hours ?? null,
              jobPercentage: salaryRecord.jobPercentage ?? null,
              pensionEmployeeAmount: salaryRecord.pensionEmployeeAmount ?? null,
              pensionEmployeePercentage: salaryRecord.pensionEmployeePercentage ?? null,
              pensionEmployerAmount: salaryRecord.pensionEmployerAmount ?? null,
              pensionEmployerPercentage: salaryRecord.pensionEmployerPercentage ?? null,
              pensionFundId: salaryRecord.pensionFundId ?? null,
              recovery: salaryRecord.recovery ?? null,
              sicknessDaysBalance: salaryRecord.sicknessDaysBalance ?? null,
              socialSecurityAmountEmployee: salaryRecord.socialSecurityAmountEmployee ?? null,
              socialSecurityAmountEmployer: salaryRecord.socialSecurityAmountEmployer ?? null,
              taxAmount: salaryRecord.taxAmount ?? null,
              trainingFundEmployeeAmount: salaryRecord.trainingFundEmployeeAmount ?? null,
              trainingFundEmployeePercentage: salaryRecord.trainingFundEmployeePercentage ?? null,
              trainingFundEmployerAmount: salaryRecord.trainingFundEmployerAmount ?? null,
              trainingFundEmployerPercentage: salaryRecord.trainingFundEmployerPercentage ?? null,
              trainingFundId: salaryRecord.trainingFundId ?? null,
              travelAndSubsistence: salaryRecord.travelAndSubsistence ?? null,
              vacationDaysBalance: salaryRecord.vacationDaysBalance ?? null,
              vacationTakeout: salaryRecord.vacationTakeout ?? null,
              workDays: salaryRecord.workDays ?? null,
              zkufot: salaryRecord.zkufot ?? null,
            }));
            const res = await injector.get(SalariesProvider).insertSalaryRecords({ salaryRecords });
            if (res.length !== 1) {
              throw new Error('Failed to insert salary record');
            }
            return res[0];
          } catch (e) {
            const message = `Failed to insert salary record of employee ID=${salaryRecord.employeeId} on month ${salaryRecord.month}`;
            console.error(`${message}: ${e}`);
          }

          throw new Error(
            `Failed to update salary record of employee ID=${salaryRecord.employeeId} on month ${salaryRecord.month}`,
          );
        });

        const updatedRecords = await Promise.all(recordsPromises);
        return {
          salaryRecords: updatedRecords,
        };
      } catch (e) {
        return {
          __typename: 'CommonError',
          message:
            (e as Error)?.message ??
            (e as { errors: Error[] })?.errors.map(e => e.message).toString() ??
            'Unknown error',
        };
      }
    },
    insertSalaryRecordsFromFile,
  },
  UpdateSalaryRecordResult: {
    __resolveType: obj => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'UpdateSalaryRecordSuccessfulResult';
    },
  },
  InsertSalaryRecordsResult: {
    __resolveType: obj => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'InsertSalaryRecordsSuccessfulResult';
    },
  },
  SalaryCharge: {
    salaryRecords: (DbCharge, _, { injector }) => {
      return injector.get(SalariesProvider).getSalaryRecordsByChargeIdLoader.load(DbCharge.id);
    },
    employees: async (DbCharge, _, { injector }) => {
      const salaryRecords = await injector
        .get(SalariesProvider)
        .getSalaryRecordsByChargeIdLoader.load(DbCharge.id);
      return injector
        .get(BusinessesProvider)
        .getBusinessByIdLoader.loadMany(salaryRecords.map(salaryRecord => salaryRecord.employee_id))
        .then(
          res =>
            res.map(employee => {
              if (!employee || employee instanceof Error) {
                throw new GraphQLError(
                  `Employee not found for one of the salary record of charge ${DbCharge.id}`,
                );
              }
              return employee;
            }) ?? [],
        );
    },
  },
  Salary: {
    directAmount: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.direct_payment_amount, defaultLocalCurrency),
    baseAmount: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      DbSalary.base_salary
        ? formatFinancialAmount(DbSalary.base_salary, defaultLocalCurrency)
        : null,
    employee: (DbSalary, _, { injector }) =>
      injector
        .get(BusinessesProvider)
        .getBusinessByIdLoader.load(DbSalary.employee_id)
        .then(res => res ?? null),
    employer: (DbSalary, _, { injector }) =>
      injector
        .get(BusinessesProvider)
        .getBusinessByIdLoader.load(DbSalary.employer)
        .then(res => res ?? null),
    pensionFund: (DbSalary, _, { injector }) =>
      DbSalary.pension_fund_id
        ? injector
            .get(BusinessesProvider)
            .getBusinessByIdLoader.load(DbSalary.pension_fund_id)
            .then(res => res ?? null)
        : null,
    pensionEmployeeAmount: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.pension_employee_amount, defaultLocalCurrency),
    pensionEmployeePercentage: DbSalary => DbSalary.pension_employee_percentage,
    pensionEmployerAmount: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.pension_employer_amount, defaultLocalCurrency),
    pensionEmployerPercentage: DbSalary => DbSalary.pension_employer_percentage,
    compensationsAmount: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.compensations_employer_amount, defaultLocalCurrency),
    compensationsPercentage: DbSalary => DbSalary.compensations_employer_percentage,
    trainingFund: (DbSalary, _, { injector }) =>
      DbSalary.training_fund_id
        ? injector
            .get(BusinessesProvider)
            .getBusinessByIdLoader.load(DbSalary.training_fund_id)
            .then(res => res ?? null)
        : null,
    trainingFundEmployeeAmount: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.training_fund_employee_amount, defaultLocalCurrency),
    trainingFundEmployeePercentage: DbSalary => DbSalary.training_fund_employee_percentage,
    trainingFundEmployerAmount: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.training_fund_employer_amount, defaultLocalCurrency),
    trainingFundEmployerPercentage: DbSalary => DbSalary.training_fund_employer_percentage,
    socialSecurityEmployeeAmount: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.social_security_amount_employee, defaultLocalCurrency),
    socialSecurityEmployerAmount: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.social_security_amount_employer, defaultLocalCurrency),
    incomeTaxAmount: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.tax_amount, defaultLocalCurrency),
    healthInsuranceAmount: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.health_payment_amount, defaultLocalCurrency),
    globalAdditionalHoursAmount: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.global_additional_hours, defaultLocalCurrency),
    bonus: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.bonus, defaultLocalCurrency),
    gift: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.gift, defaultLocalCurrency),
    travelAndSubsistence: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.travel_and_subsistence, defaultLocalCurrency),
    recovery: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.recovery, defaultLocalCurrency),
    vacationTakeout: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.vacation_takeout, defaultLocalCurrency),
    notionalExpense: (DbSalary, _, { adminContext: { defaultLocalCurrency } }) =>
      formatFinancialAmount(DbSalary.zkufot, defaultLocalCurrency),
    vacationDays: DbSalary => ({
      added: DbSalary.added_vacation_days ? Number(DbSalary.added_vacation_days) : null,
      balance: DbSalary.vacation_days_balance ? Number(DbSalary.vacation_days_balance) : null,
    }),
    workDays: DbSalary => (DbSalary.work_days ? Number(DbSalary.work_days) : null),
    sicknessDays: DbSalary => ({
      balance: DbSalary.sickness_days_balance ? Number(DbSalary.sickness_days_balance) : null,
    }),
    charge: (DbSalary, _, { injector }) => {
      if (!DbSalary.charge_id) {
        return null;
      }
      return injector
        .get(ChargesProvider)
        .getChargeByIdLoader.load(DbSalary.charge_id)
        .then(res => res ?? null);
    },
  },
};
