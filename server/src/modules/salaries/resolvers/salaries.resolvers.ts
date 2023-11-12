import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import { formatFinancialAmount } from '@shared/helpers';
import type { SalariesModule } from '../types.js';
import { commonSalaryFields } from './common.js';

export const salariesResolvers: SalariesModule.Resolvers = {
  CommonCharge: commonSalaryFields,
  ConversionCharge: commonSalaryFields,
  Salary: {
    directAmount: DbSalary =>
      formatFinancialAmount(DbSalary.direct_payment_amount, DEFAULT_LOCAL_CURRENCY),
    baseAmount: DbSalary =>
      DbSalary.base_salary
        ? formatFinancialAmount(DbSalary.base_salary, DEFAULT_LOCAL_CURRENCY)
        : null,
    employeeId: DbSalary => DbSalary.employee ?? 'Missing',
  },
};
