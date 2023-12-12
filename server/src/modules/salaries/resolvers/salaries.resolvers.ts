import { GraphQLError } from 'graphql';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import { formatFinancialAmount } from '@shared/helpers';
import { filterSalaryRecordsByCharge } from '../helpers/filter-salaries-by-charge.js';
import { getSalaryMonth } from '../helpers/get-month.helper.js';
import { SalariesProvider } from '../providers/salaries.provider.js';
import type { SalariesModule } from '../types.js';

export const salariesResolvers: SalariesModule.Resolvers = {
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
      DbSalary.pension_fund
        ? injector
            .get(FinancialEntitiesProvider)
            .getFinancialEntityByIdLoader.load(DbSalary.pension_fund)
            .then(res => res ?? null)
        : null,
    pensionEmployeeAmount: DbSalary =>
      formatFinancialAmount(DbSalary.pension_employee_amount, DEFAULT_LOCAL_CURRENCY),
    pensionEmployerAmount: DbSalary =>
      formatFinancialAmount(DbSalary.pension_employer_amount, DEFAULT_LOCAL_CURRENCY),
    compensationsAmount: DbSalary =>
      formatFinancialAmount(DbSalary.compensations_employer_amount, DEFAULT_LOCAL_CURRENCY),
    trainingFund: (DbSalary, _, { injector }) =>
      DbSalary.training_fun
        ? injector
            .get(FinancialEntitiesProvider)
            .getFinancialEntityByIdLoader.load(DbSalary.training_fun)
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
  },
};
