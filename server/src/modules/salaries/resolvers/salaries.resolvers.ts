import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import { formatFinancialAmount } from '@shared/helpers';
import { filterSalaryRecordsByCharge } from '../helpers/filter-salaries-by-charge.js';
import { getSalaryMonth } from '../helpers/get-month.helper.js';
import { SalariesProvider } from '../providers/salaries.provider.js';
import type { SalariesModule } from '../types.js';
import { insertSalaryRecords } from './insert-salary.resolver.js';
import { updateSalaryRecord } from './update-salary.resolver.js';

export const salariesResolvers: SalariesModule.Resolvers = {
  Query: {
    salaryRecordsByCharge: async (_, { chargeId }, { injector }) => {
      const salaryRecords = await injector
        .get(SalariesProvider)
        .getSalaryRecordsByChargeIdLoader.load(chargeId);
      return salaryRecords;
    },
    salaryRecordsByDates: async (_, { fromDate, toDate }, { injector }) => {
      const fromDateMonth = fromDate.slice(0, 7);
      const toDateMonth = toDate.slice(0, 7);
      try {
        const salaryRecords = await injector
          .get(SalariesProvider)
          .getSalaryRecordsByDates({ fromDate: fromDateMonth, toDate: toDateMonth });
        return salaryRecords.sort((a, b) => a.month.localeCompare(b.month));
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
              throw new Error();
            }
            return res[0];
          } catch (e) {
            /* empty */
          }

          try {
            const salaryRecords = params.salaryRecords.map(salaryRecord => ({
              ...salaryRecord,
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
              vacationDaysBalance: salaryRecord.vacationDaysBalance ?? null,
              vacationTakeout: salaryRecord.vacationTakeout ?? null,
              workDays: salaryRecord.workDays ?? null,
              zkufot: salaryRecord.zkufot ?? null,
            }));
            const res = await injector.get(SalariesProvider).insertSalaryRecords({ salaryRecords });
            if (res.length !== 1) {
              throw new Error();
            }
            return res[0];
          } catch (e) {
            /* empty */
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
  },
  SalaryCharge: {
    salaryRecords: (DbCharge, _, { injector }) => {
      return injector.get(SalariesProvider).getSalaryRecordsByChargeIdLoader.load(DbCharge.id);
    },
    salaryRecordsSuggestions: (DbCharge, _, { injector }) => {
      const dateString = DbCharge.transactions_min_event_date?.toISOString().slice(0, 7);
      if (!dateString) {
        return [];
      }
      const month = getSalaryMonth(DbCharge);
      if (!month) {
        return [];
      }
      return injector
        .get(SalariesProvider)
        .getSalaryRecordsByMonthLoader.load(month)
        .then(res => filterSalaryRecordsByCharge(DbCharge, res));
    },
    employees: async (DbCharge, _, { injector }) => {
      const salaryRecords = await injector
        .get(SalariesProvider)
        .getSalaryRecordsByChargeIdLoader.load(DbCharge.id);
      return injector
        .get(FinancialEntitiesProvider)
        .getFinancialEntityByIdLoader.loadMany(
          salaryRecords.map(salaryRecord => salaryRecord.employee_id),
        )
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
    directAmount: DbSalary =>
      formatFinancialAmount(DbSalary.direct_payment_amount, DEFAULT_LOCAL_CURRENCY),
    baseAmount: DbSalary =>
      DbSalary.base_salary
        ? formatFinancialAmount(DbSalary.base_salary, DEFAULT_LOCAL_CURRENCY)
        : null,
    employee: (DbSalary, _, { injector }) =>
      injector
        .get(FinancialEntitiesProvider)
        .getFinancialEntityByIdLoader.load(DbSalary.employee_id)
        .then(res => res ?? null),
    pensionFund: (DbSalary, _, { injector }) =>
      DbSalary.pension_fund_id
        ? injector
            .get(FinancialEntitiesProvider)
            .getFinancialEntityByIdLoader.load(DbSalary.pension_fund_id)
            .then(res => res ?? null)
        : null,
    pensionEmployeeAmount: DbSalary =>
      formatFinancialAmount(DbSalary.pension_employee_amount, DEFAULT_LOCAL_CURRENCY),
    pensionEmployerAmount: DbSalary =>
      formatFinancialAmount(DbSalary.pension_employer_amount, DEFAULT_LOCAL_CURRENCY),
    compensationsAmount: DbSalary =>
      formatFinancialAmount(DbSalary.compensations_employer_amount, DEFAULT_LOCAL_CURRENCY),
    trainingFund: (DbSalary, _, { injector }) =>
      DbSalary.training_fund_id
        ? injector
            .get(FinancialEntitiesProvider)
            .getFinancialEntityByIdLoader.load(DbSalary.training_fund_id)
            .then(res => res ?? null)
        : null,
    trainingFundEmployeeAmount: DbSalary =>
      formatFinancialAmount(DbSalary.training_fund_employee_amount, DEFAULT_LOCAL_CURRENCY),
    trainingFundEmployerAmount: DbSalary =>
      formatFinancialAmount(DbSalary.training_fund_employee_amount, DEFAULT_LOCAL_CURRENCY),
    socialSecurityEmployeeAmount: DbSalary =>
      formatFinancialAmount(DbSalary.social_security_amount_employee, DEFAULT_LOCAL_CURRENCY),
    socialSecurityEmployerAmount: DbSalary =>
      formatFinancialAmount(DbSalary.social_security_amount_employer, DEFAULT_LOCAL_CURRENCY),
    incomeTaxAmount: DbSalary => formatFinancialAmount(DbSalary.tax_amount, DEFAULT_LOCAL_CURRENCY),
    healthInsuranceAmount: DbSalary =>
      formatFinancialAmount(DbSalary.health_payment_amount, DEFAULT_LOCAL_CURRENCY),
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
