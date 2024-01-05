import { SalariesProvider } from '../providers/salaries.provider.js';
import type { SalariesModule } from '../types';

export const insertSalaryRecords: SalariesModule.MutationResolvers['insertSalaryRecords'] = async (
  _,
  params,
  { injector },
) => {
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
    if (res.length !== salaryRecords.length) {
      throw new Error(`Failed to insert salary records`);
    }
    return {
      salaryRecords: res,
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
