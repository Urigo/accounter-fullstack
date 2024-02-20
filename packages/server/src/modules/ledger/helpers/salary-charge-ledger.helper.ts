import { GraphQLError } from 'graphql';
import type { IGetChargesByIdsResult } from '@modules/charges/types';
import type { IGetSalaryRecordsByChargeIdsResult } from '@modules/salaries/types.js';
import {
  COMPENSATION_FUND_EXPENSES_TAX_CATEGORY_ID,
  DEFAULT_LOCAL_CURRENCY,
  PENSION_EXPENSES_TAX_CATEGORY_ID,
  SALARY_EXPENSES_TAX_CATEGORY_ID,
  SOCIAL_SECURITY_BUSINESS_ID,
  SOCIAL_SECURITY_EXPENSES_TAX_CATEGORY_ID,
  TAX_DEDUCTIONS_BUSINESS_ID,
  TRAINING_FUND_EXPENSES_TAX_CATEGORY_ID,
  ZKUFOT_EXPENSES_TAX_CATEGORY_ID,
  ZKUFOT_INCOME_TAX_CATEGORY_ID,
} from '@shared/constants';
import type { CounterAccountProto, LedgerProto } from '@shared/types';

function generateEntryRaw(
  accountId: CounterAccountProto,
  amount: number,
  month: string,
  transactionDate: Date,
  ownerId: string,
  isCreditor: boolean,
  chargeId: string,
): LedgerProto {
  return {
    id: `${accountId}|${month}`,
    invoiceDate: transactionDate,
    valueDate: transactionDate,
    currency: DEFAULT_LOCAL_CURRENCY,
    ...(isCreditor ? { creditAccountID1: accountId } : { debitAccountID1: accountId }),
    localCurrencyCreditAmount1: amount,
    localCurrencyDebitAmount1: amount,
    description: `${month} salary: ${accountId}`,
    isCreditorCounterparty: false,
    ownerId,
    chargeId,
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

type MonthlyLedgerProto = { taxCategoryId: string; amount: number; isCredit: boolean };

export function generateEntriesFromSalaryRecords(
  salaryRecords: IGetSalaryRecordsByChargeIdsResult[],
  charge: IGetChargesByIdsResult,
  transactionDate: Date,
): {
  entries: LedgerProto[];
  monthlyEntriesProto: MonthlyLedgerProto[];
  month: string;
} {
  const chargeId = charge.id;

  if (!salaryRecords.length) {
    throw new GraphQLError(`No salary records found for charge ${chargeId}`);
  }

  const entries: LedgerProto[] = [];

  function generateEntry(
    chargeId: string,
    accountId: string,
    amount: number,
    month: string,
    isCreditor = true,
    date?: Date,
  ) {
    return generateEntryRaw(
      accountId,
      amount,
      month,
      date ?? transactionDate,
      charge.owner_id,
      isCreditor,
      chargeId,
    );
  }

  const amountPerBusiness: Record<string, number> = {};
  const taxAmountPerMonth: Record<string, number> = {};
  let month: string | undefined = undefined;

  // expenses
  let salaryExpensesAmount = 0;
  let socialSecurityExpensesAmount = 0;
  let pensionFundExpensesAmount = 0;
  let compensationProvidentFundExpensesAmount = 0;
  let trainingFundExpensesAmount = 0;
  let zkufotAmount = 0;

  for (const salaryRecord of salaryRecords) {
    // record validations
    if (!salaryRecord.base_salary) {
      throw new GraphQLError(
        `Base salary record for ${salaryRecord.month}, employee ID=${salaryRecord.employee_id}  is missing amount`,
      );
    }

    month ??= salaryRecord.month;

    const salaryExpense =
      Number(salaryRecord.base_salary ?? '0') +
      Number(salaryRecord.global_additional_hours ?? '0') +
      Number(salaryRecord.bonus ?? '0') +
      Number(salaryRecord.gift ?? '0') +
      Number(salaryRecord.recovery ?? '0') +
      Number(salaryRecord.vacation_takeout ?? '0');

    const directPayment =
      salaryExpense -
      Number(salaryRecord.social_security_amount_employee ?? '0') -
      Number(salaryRecord.health_payment_amount ?? '0') -
      Number(salaryRecord.tax_amount ?? '0') -
      Number(salaryRecord.pension_employee_amount ?? '0') -
      Number(salaryRecord.training_fund_employee_amount ?? '0');

    // generate salary entry
    const salaryDate = new Date(transactionDate);
    salaryDate.setDate(salaryDate.getDate() - 2); // adjusted date to match exchange rate of transaction initiation date
    entries.push(
      generateEntry(
        charge.id,
        salaryRecord.employee_id,
        directPayment,
        salaryRecord.month,
        undefined,
        salaryDate,
      ),
    );

    // salary expenses handling
    salaryExpensesAmount += salaryExpense;

    // social security handling
    const socialSecurityEmployeeAmount = Number(
      salaryRecord.social_security_amount_employee ?? '0',
    );
    const socialSecurityEmployerAmount = Number(
      salaryRecord.social_security_amount_employer ?? '0',
    );
    const HealthPaymentAmount = Number(salaryRecord.health_payment_amount ?? '0');
    amountPerBusiness[SOCIAL_SECURITY_BUSINESS_ID] ??= 0;
    amountPerBusiness[SOCIAL_SECURITY_BUSINESS_ID] +=
      socialSecurityEmployeeAmount + socialSecurityEmployerAmount + HealthPaymentAmount;
    socialSecurityExpensesAmount += Number(salaryRecord.social_security_amount_employer ?? '0');

    // pension handling
    const totalPension = getTotalPension(salaryRecord);
    const pensionAccount = salaryRecord.pension_fund_id;
    if (totalPension > 0) {
      if (!pensionAccount) {
        throw new GraphQLError(`Missing pension account for ${chargeId}`);
      }
      amountPerBusiness[pensionAccount] ??= 0;
      amountPerBusiness[pensionAccount] += totalPension;
    }
    pensionFundExpensesAmount += Number(salaryRecord.pension_employer_amount ?? '0');
    compensationProvidentFundExpensesAmount += Number(
      salaryRecord.compensations_employer_amount ?? '0',
    );

    // training fund handling
    const totalTrainingFund = getTotalTrainingFund(salaryRecord);
    const trainingFundAccount = salaryRecord.training_fund_id;
    if (totalTrainingFund > 0) {
      if (!trainingFundAccount) {
        throw new GraphQLError(`Missing training fund account for ${chargeId}`);
      }
      amountPerBusiness[trainingFundAccount] ??= 0;
      amountPerBusiness[trainingFundAccount] += totalTrainingFund;
    }
    trainingFundExpensesAmount += Number(salaryRecord.training_fund_employer_amount ?? '0');

    // tax handling
    taxAmountPerMonth[salaryRecord.month] ??= 0;
    taxAmountPerMonth[salaryRecord.month] += Number(salaryRecord.tax_amount ?? '0');

    // zkufot handling
    zkufotAmount += Number(salaryRecord.zkufot ?? '0');
  }

  if (!month) {
    throw new GraphQLError(`No month found for salary charge ${chargeId}`);
  }

  // generate pension/training funds entries
  for (const [businessId, amount] of Object.entries(amountPerBusiness)) {
    if (amount) {
      entries.push(generateEntry(charge.id, businessId, amount, month));
    }
  }

  // generate tax entries
  for (const [month, amount] of Object.entries(taxAmountPerMonth)) {
    if (amount > 0) {
      entries.push(generateEntry(charge.id, TAX_DEDUCTIONS_BUSINESS_ID, amount, month));
    }
  }

  const monthlyEntriesProto = getMonthlyExpensesEntriesProto({
    salaryExpensesAmount,
    socialSecurityExpensesAmount,
    pensionFundExpensesAmount,
    compensationProvidentFundExpensesAmount,
    trainingFundExpensesAmount,
    zkufotAmount,
  });

  return {
    entries,
    monthlyEntriesProto,
    month,
  };
}

export function getMonthlyExpensesEntriesProto({
  salaryExpensesAmount,
  socialSecurityExpensesAmount,
  pensionFundExpensesAmount,
  compensationProvidentFundExpensesAmount,
  trainingFundExpensesAmount,
  zkufotAmount,
}: {
  salaryExpensesAmount: number;
  socialSecurityExpensesAmount: number;
  pensionFundExpensesAmount: number;
  compensationProvidentFundExpensesAmount: number;
  trainingFundExpensesAmount: number;
  zkufotAmount: number;
}) {
  const monthlyEntriesProto: MonthlyLedgerProto[] = [
    {
      taxCategoryId: ZKUFOT_EXPENSES_TAX_CATEGORY_ID,
      amount: zkufotAmount,
      isCredit: false,
    },
    {
      taxCategoryId: ZKUFOT_INCOME_TAX_CATEGORY_ID,
      amount: zkufotAmount,
      isCredit: true,
    },
    {
      taxCategoryId: SOCIAL_SECURITY_EXPENSES_TAX_CATEGORY_ID,
      amount: socialSecurityExpensesAmount,
      isCredit: false,
    },
    {
      taxCategoryId: SALARY_EXPENSES_TAX_CATEGORY_ID,
      amount: salaryExpensesAmount,
      isCredit: false,
    },
    {
      taxCategoryId: TRAINING_FUND_EXPENSES_TAX_CATEGORY_ID,
      amount: trainingFundExpensesAmount,
      isCredit: false,
    },
    {
      taxCategoryId: PENSION_EXPENSES_TAX_CATEGORY_ID,
      amount: pensionFundExpensesAmount,
      isCredit: false,
    },
    {
      taxCategoryId: COMPENSATION_FUND_EXPENSES_TAX_CATEGORY_ID,
      amount: compensationProvidentFundExpensesAmount,
      isCredit: false,
    },
  ];

  return monthlyEntriesProto;
}
