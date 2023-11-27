import { GraphQLError } from 'graphql';
import type { IGetChargesByIdsResult } from '@modules/charges/types';
import { getSalaryChargeType } from '@modules/salaries/helpers/salary-charge-type.js';
import type { IGetSalaryRecordsByChargeIdsResult } from '@modules/salaries/types.js';
import {
  DEFAULT_LOCAL_CURRENCY,
  SOCIAL_SECURITY_BUSINESS_ID,
  TAX_DEDUCTIONS_BUSINESS_ID,
} from '@shared/constants';
import { SalaryChargeTypeEnum } from '@shared/enums';
import type { LedgerProto } from '@shared/types';

function generateEntryRaw(
  accountId: string,
  amount: number,
  month: string,
  transactionDate: Date,
  salaryType: SalaryChargeTypeEnum,
  ownerId: string,
): LedgerProto {
  return {
    id: `${month}|${accountId}|${salaryType}`,
    invoiceDate: transactionDate,
    valueDate: transactionDate,
    currency: DEFAULT_LOCAL_CURRENCY,
    creditAccountID1: accountId,
    localCurrencyCreditAmount1: amount,
    localCurrencyDebitAmount1: amount,
    description: `${month} salary (${salaryType}): ${accountId}`,
    isCreditorCounterparty: true, // TODO: check
    ownerId,
  };
}

function getTotalPension(salaryRecord: IGetSalaryRecordsByChargeIdsResult): number {
  const pensionEmployerAmount = Number(salaryRecord.pension_employer_amount ?? '0');
  const pensionEmployeeAmount = Number(salaryRecord.pension_employee_amount ?? '0');
  const compensationsEmployerAmount = Number(salaryRecord.compensations_employer_amount ?? '0');

  const totalPension = pensionEmployeeAmount + pensionEmployerAmount + compensationsEmployerAmount;

  return totalPension;
}

function getTotalTrainingFund(salaryRecord: IGetSalaryRecordsByChargeIdsResult) {
  const trainingFundEmployerAmount = Number(salaryRecord.training_fund_employer_amount ?? '0');
  const trainingFundEmployeeAmount = Number(salaryRecord.training_fund_employee_amount ?? '0');
  const totalTrainingFund = trainingFundEmployeeAmount + trainingFundEmployerAmount;

  return totalTrainingFund;
}

export function generateEntriesFromSalaryRecords(
  salaryRecords: IGetSalaryRecordsByChargeIdsResult[],
  charge: IGetChargesByIdsResult,
  transactionDate: Date,
): { entries: LedgerProto[]; balanceDelta: number } {
  const chargeId = charge.id;

  if (!salaryRecords.length) {
    throw new GraphQLError(`No salary records found for charge ${chargeId}`);
  }

  const salaryType = getSalaryChargeType(salaryRecords, chargeId);
  if (salaryType === SalaryChargeTypeEnum.unknown) {
    throw new GraphQLError(`Salary charge id ${chargeId} type is unknown`);
  }

  const entries: LedgerProto[] = [];
  let balanceDelta = 0;

  function generateEntry(accountId: string, amount: number, month: string) {
    return generateEntryRaw(accountId, amount, month, transactionDate, salaryType, charge.owner_id);
  }

  switch (salaryType) {
    case SalaryChargeTypeEnum.salary: {
      for (const salaryRecord of salaryRecords) {
        if (!salaryRecord.direct_payment_amount) {
          throw new GraphQLError(
            `Salary record for ${salaryRecord.month}, employee ${salaryRecord.employee}  is missing amount`,
          );
        }

        entries.push(
          generateEntry(
            salaryRecord.employee_id,
            Number(salaryRecord.direct_payment_amount),
            salaryRecord.month,
          ),
        );
        balanceDelta += Number(salaryRecord.direct_payment_amount);
      }
      break;
    }
    case SalaryChargeTypeEnum.funds: {
      const amountPerBusiness: Record<string, number> = {};

      for (const salaryRecord of salaryRecords) {
        const totalPension = getTotalPension(salaryRecord);
        const pensionAccount = salaryRecord.pension_fund;
        if (totalPension > 0) {
          if (!pensionAccount) {
            throw new GraphQLError(`Missing pension account for ${chargeId}`);
          }
          amountPerBusiness[pensionAccount] ??= 0;
          amountPerBusiness[pensionAccount] += totalPension;
        }

        const totalTrainingFund = getTotalTrainingFund(salaryRecord);
        const trainingFundAccount = salaryRecord.training_fun;
        if (totalTrainingFund > 0) {
          if (!trainingFundAccount) {
            throw new GraphQLError(`Missing training fund account for ${chargeId}`);
          }
          amountPerBusiness[trainingFundAccount] ??= 0;
          amountPerBusiness[trainingFundAccount] += totalTrainingFund;
        }
      }

      for (const [accountId, amount] of Object.entries(amountPerBusiness)) {
        entries.push(generateEntry(accountId, amount, salaryRecords[0].month));
        balanceDelta += amount;
      }
      break;
    }
    case SalaryChargeTypeEnum.pension: {
      const amountPerBusiness: Record<string, number> = {};

      for (const salaryRecord of salaryRecords) {
        const totalPension = getTotalPension(salaryRecord);
        const pensionAccount = salaryRecord.pension_fund;
        if (totalPension > 0) {
          if (!pensionAccount) {
            throw new GraphQLError(`Missing pension account for ${chargeId}`);
          }
          if (pensionAccount !== charge.business_id) {
            throw new GraphQLError(
              `Pension account ${pensionAccount} does not match transaction business id ${charge.business_id}`,
            );
          }
          amountPerBusiness[pensionAccount] ??= 0;
          amountPerBusiness[pensionAccount] += totalPension;
        }
      }

      for (const [accountId, amount] of Object.entries(amountPerBusiness)) {
        entries.push(generateEntry(accountId, amount, salaryRecords[0].month));
        balanceDelta += amount;
      }
      break;
    }
    case SalaryChargeTypeEnum.trainingFund: {
      const amountPerBusiness: Record<string, number> = {};

      for (const salaryRecord of salaryRecords) {
        const totalTrainingFund = getTotalTrainingFund(salaryRecord);
        const trainingFundAccount = salaryRecord.training_fun;
        if (totalTrainingFund > 0) {
          if (!trainingFundAccount) {
            throw new GraphQLError(`Missing training fund account for ${chargeId}`);
          }
          if (trainingFundAccount !== charge.business_id) {
            throw new GraphQLError(
              `Training fund account ${trainingFundAccount} does not match transaction business id ${charge.business_id}`,
            );
          }
          amountPerBusiness[trainingFundAccount] ??= 0;
          amountPerBusiness[trainingFundAccount] += totalTrainingFund;
        }
      }

      for (const [accountId, amount] of Object.entries(amountPerBusiness)) {
        entries.push(generateEntry(accountId, amount, salaryRecords[0].month));
        balanceDelta += amount;
      }
      break;
    }
    case SalaryChargeTypeEnum.socialSecurity: {
      const amountPerMonth: Record<string, number> = {};
      for (const salaryRecord of salaryRecords) {
        const socialSecurityEmployeeAmount = Number(
          salaryRecord.social_security_amount_employee ?? '0',
        );
        const socialSecurityEmployerAmount = Number(
          salaryRecord.social_security_amount_employer ?? '0',
        );
        const HealthPaymentAmount = Number(salaryRecord.health_payment_amount ?? '0');
        amountPerMonth[salaryRecord.month] ??= 0;
        amountPerMonth[salaryRecord.month] +=
          socialSecurityEmployeeAmount + socialSecurityEmployerAmount + HealthPaymentAmount;
      }

      for (const [month, amount] of Object.entries(amountPerMonth)) {
        if (amount > 0) {
          entries.push(generateEntry(SOCIAL_SECURITY_BUSINESS_ID, amount, month));
          balanceDelta += amount;
        }
      }
      break;
    }
    case SalaryChargeTypeEnum.incomeTax: {
      const amountPerMonth: Record<string, number> = {};
      for (const salaryRecord of salaryRecords) {
        amountPerMonth[salaryRecord.month] ??= 0;
        amountPerMonth[salaryRecord.month] += Number(salaryRecord.tax_amount ?? '0');
      }

      for (const [month, amount] of Object.entries(amountPerMonth)) {
        if (amount > 0) {
          entries.push(generateEntry(TAX_DEDUCTIONS_BUSINESS_ID, amount, month));
          balanceDelta += amount;
        }
      }
      break;
    }
  }

  return {
    entries,
    balanceDelta,
  };
}
