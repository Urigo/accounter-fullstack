import { lastDayOfMonth } from 'date-fns';
import type { IGetChargesByIdsResult } from '@modules/charges/__generated__/charges-temp.types.js';
import type { IGetSalaryRecordsByChargeIdsResult } from '@modules/salaries/types.js';
import type { LedgerProto } from '@shared/types';
import { LedgerError } from './utils.helper.js';

function generateEntryRaw(
  accountId: string,
  amount: number,
  month: string,
  transactionDate: Date,
  ownerId: string,
  isCreditor: boolean,
  chargeId: string,
  context: GraphQLModules.Context,
): LedgerProto {
  return {
    id: `${accountId}|${month}`,
    invoiceDate: transactionDate,
    valueDate: transactionDate,
    currency: context.adminContext.defaultLocalCurrency,
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
  context: GraphQLModules.Context,
): {
  entries: LedgerProto[];
  monthlyEntriesProto: MonthlyLedgerProto[];
  month: string;
} {
  const {
    salaries: { taxDeductionsBusinessId },
    authorities: { socialSecurityBusinessId },
  } = context.adminContext;
  const chargeId = charge.id;

  if (!salaryRecords.length) {
    throw new LedgerError(`No salary records found for charge ${chargeId}`);
  }
  if (!taxDeductionsBusinessId) {
    throw new LedgerError('Tax deductions business is not set');
  }

  const entries: LedgerProto[] = [];

  function generateEntry(
    chargeId: string,
    accountId: string,
    amount: number,
    month: string,
    isCreditor = true,
  ) {
    return generateEntryRaw(
      accountId,
      amount,
      month,
      lastDayOfMonth(new Date(`${month}-01`)),
      charge.owner_id,
      isCreditor,
      chargeId,
      context,
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
      throw new LedgerError(
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
      Number(salaryRecord.vacation_takeout ?? '0') +
      Number(salaryRecord.travel_and_subsistence ?? '0');

    const directPayment =
      salaryExpense -
      Number(salaryRecord.social_security_amount_employee ?? '0') -
      Number(salaryRecord.health_payment_amount ?? '0') -
      Number(salaryRecord.tax_amount ?? '0') -
      Number(salaryRecord.pension_employee_amount ?? '0') -
      Number(salaryRecord.training_fund_employee_amount ?? '0');
    entries.push(
      generateEntry(charge.id, salaryRecord.employee_id, directPayment, salaryRecord.month),
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
    amountPerBusiness[socialSecurityBusinessId] ??= 0;
    amountPerBusiness[socialSecurityBusinessId] +=
      socialSecurityEmployeeAmount + socialSecurityEmployerAmount + HealthPaymentAmount;
    socialSecurityExpensesAmount += Number(salaryRecord.social_security_amount_employer ?? '0');

    // pension handling
    const totalPension = getTotalPension(salaryRecord);
    const pensionAccount = salaryRecord.pension_fund_id;
    if (totalPension > 0) {
      if (!pensionAccount) {
        throw new LedgerError(`Missing pension account for charge ID=${chargeId}`);
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
        throw new LedgerError(`Missing training fund account for charge ID=${chargeId}`);
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
    throw new LedgerError(`No month found for salary charge ID=${chargeId}`);
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
      entries.push(generateEntry(charge.id, taxDeductionsBusinessId, amount, month));
    }
  }

  const monthlyEntriesProto = getMonthlyExpensesEntriesProto({
    salaryExpensesAmount,
    socialSecurityExpensesAmount,
    pensionFundExpensesAmount,
    compensationProvidentFundExpensesAmount,
    trainingFundExpensesAmount,
    zkufotAmount,
    context,
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
  context,
}: {
  salaryExpensesAmount: number;
  socialSecurityExpensesAmount: number;
  pensionFundExpensesAmount: number;
  compensationProvidentFundExpensesAmount: number;
  trainingFundExpensesAmount: number;
  zkufotAmount: number;
  context: GraphQLModules.Context;
}) {
  const {
    zkufotExpensesTaxCategoryId,
    zkufotIncomeTaxCategoryId,
    socialSecurityExpensesTaxCategoryId,
    salaryExpensesTaxCategoryId,
    trainingFundExpensesTaxCategoryId,
    pensionExpensesTaxCategoryId,
    compensationFundExpensesTaxCategoryId,
  } = context.adminContext.salaries;
  if (
    !zkufotExpensesTaxCategoryId ||
    !zkufotIncomeTaxCategoryId ||
    !socialSecurityExpensesTaxCategoryId ||
    !salaryExpensesTaxCategoryId ||
    !trainingFundExpensesTaxCategoryId ||
    !pensionExpensesTaxCategoryId ||
    !compensationFundExpensesTaxCategoryId
  ) {
    throw new LedgerError('Missing salary tax categories');
  }
  const monthlyEntriesProto: MonthlyLedgerProto[] = [
    {
      taxCategoryId: zkufotExpensesTaxCategoryId,
      amount: zkufotAmount,
      isCredit: false,
    },
    {
      taxCategoryId: zkufotIncomeTaxCategoryId,
      amount: zkufotAmount,
      isCredit: true,
    },
    {
      taxCategoryId: socialSecurityExpensesTaxCategoryId,
      amount: socialSecurityExpensesAmount,
      isCredit: false,
    },
    {
      taxCategoryId: salaryExpensesTaxCategoryId,
      amount: salaryExpensesAmount,
      isCredit: false,
    },
    {
      taxCategoryId: trainingFundExpensesTaxCategoryId,
      amount: trainingFundExpensesAmount,
      isCredit: false,
    },
    {
      taxCategoryId: pensionExpensesTaxCategoryId,
      amount: pensionFundExpensesAmount,
      isCredit: false,
    },
    {
      taxCategoryId: compensationFundExpensesTaxCategoryId,
      amount: compensationProvidentFundExpensesAmount,
      isCredit: false,
    },
  ];

  return monthlyEntriesProto;
}
