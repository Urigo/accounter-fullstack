import { SalariesProvider } from '../providers/salaries.provider.js';
import type { SalariesModule } from '../types';

export const updateSalaryRecord: SalariesModule.MutationResolvers['updateSalaryRecord'] = async (
  _,
  { salaryRecord },
  { injector },
) => {
  try {
    const res = await injector.get(SalariesProvider).updateSalaryRecord(salaryRecord);
    if (res.length !== 1) {
      throw new Error(
        `Failed to update salary record of employee ID=${salaryRecord.employeeId} on month ${salaryRecord.month}`,
      );
    }
    return {
      salaryRecord: res[0],
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
};
