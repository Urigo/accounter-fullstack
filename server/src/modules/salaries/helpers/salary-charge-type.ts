import { GraphQLError } from 'graphql';
import { SalaryChargeTypeEnum } from '@shared/enums';
import { IGetSalaryRecordsByChargeIdsResult } from '../types.js';

export function getSalaryChargeType(
  salaryRecords: IGetSalaryRecordsByChargeIdsResult[],
  chargeId: string,
): SalaryChargeTypeEnum {
  if (salaryRecords.length === 0) {
    return SalaryChargeTypeEnum.unknown;
  }
  const type = new Set<SalaryChargeTypeEnum>();
  for (const salaryRecord of salaryRecords) {
    if (salaryRecord.employee_salary_charge_id === chargeId) {
      type.add(SalaryChargeTypeEnum.salary);
    } else if (
      salaryRecord.pension_charge_id === chargeId &&
      salaryRecord.training_fund_charge_id === chargeId
    ) {
      type.add(SalaryChargeTypeEnum.funds);
    } else if (salaryRecord.pension_charge_id === chargeId) {
      type.add(SalaryChargeTypeEnum.pension);
    } else if (salaryRecord.training_fund_charge_id === chargeId) {
      type.add(SalaryChargeTypeEnum.trainingFund);
    } else if (salaryRecord.social_security_charge_id === chargeId) {
      type.add(SalaryChargeTypeEnum.socialSecurity);
    } else if (salaryRecord.tax_charge_id === chargeId) {
      type.add(SalaryChargeTypeEnum.incomeTax);
    } else {
      type.add(SalaryChargeTypeEnum.unknown);
    }
  }

  if (type.size === 0) {
    return SalaryChargeTypeEnum.unknown;
  }
  if (type.size > 1) {
    throw new GraphQLError(`Salary charge id ${chargeId} is used for multiple salary charge types`);
  }
  return type.values().next().value;
}
