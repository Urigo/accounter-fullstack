import { format } from 'date-fns';
import type {
  IGetChargesByFinancialAccountNumbersResult,
  IGetChargesByIdsResult,
} from '../__generated__/charges.types.mjs';
import { getChargeExchangeRates } from '../providers/exchange.mjs';
import { VatIndexesKeys } from '../providers/hashavshevet.mjs';
import { TimelessDateString } from '../scalars/index.js';
import { TAX_CATEGORIES_WITH_NOT_FULL_VAT } from './constants.mjs';
import { getILSForDate } from './exchange.mjs';

export type VatExtendedCharge = IGetChargesByIdsResult & {
  vatAfterDiduction: number;
  amountBeforeVAT: number;
  amountBeforeFullVAT: number;
};

export function decorateCharge(charge: IGetChargesByIdsResult): VatExtendedCharge {
  const decoreatedCharge: Partial<VatExtendedCharge> = { ...charge };

  // If foriegn transaction, can use receipt as invoice
  if (
    decoreatedCharge.currency_code != 'ILS' &&
    !decoreatedCharge.tax_invoice_date &&
    !decoreatedCharge.tax_invoice_number &&
    !decoreatedCharge.tax_invoice_file &&
    !decoreatedCharge.proforma_invoice_file &&
    decoreatedCharge.receipt_number &&
    decoreatedCharge.receipt_date &&
    decoreatedCharge.receipt_url &&
    decoreatedCharge.receipt_image
  ) {
    decoreatedCharge.tax_invoice_date = decoreatedCharge.receipt_date;
    decoreatedCharge.tax_invoice_number = decoreatedCharge.receipt_number;
    decoreatedCharge.tax_invoice_file = decoreatedCharge.receipt_url;
    decoreatedCharge.proforma_invoice_file = decoreatedCharge.receipt_image;
  }

  // what is happening here?
  if (decoreatedCharge.tax_invoice_currency) {
    decoreatedCharge.currency_code = decoreatedCharge.tax_invoice_currency;
    decoreatedCharge.event_amount = decoreatedCharge.tax_invoice_amount ?? undefined;
    if (decoreatedCharge.account_type == 'creditcard') {
      decoreatedCharge.account_type = 'checking_usd';
    } else {
      decoreatedCharge.debit_date = decoreatedCharge.tax_invoice_date;
    }
  }

  const amountToUse = parseFloat(
    (decoreatedCharge.tax_invoice_amount
      ? decoreatedCharge.tax_invoice_amount
      : decoreatedCharge.event_amount) ?? '0',
  );
  decoreatedCharge.vatAfterDiduction = !TAX_CATEGORIES_WITH_NOT_FULL_VAT.includes(
    decoreatedCharge.tax_category ?? '',
  )
    ? decoreatedCharge.vat ?? 0
    : ((decoreatedCharge.vat ?? 0) / 3) * 2;

  // TODO(Uri): Add a check if there is vat and it's not equal for 17 percent, let us know
  decoreatedCharge.amountBeforeVAT = amountToUse - decoreatedCharge.vatAfterDiduction;

  decoreatedCharge.amountBeforeFullVAT = amountToUse - (decoreatedCharge.vat ?? 0);

  return decoreatedCharge as VatExtendedCharge;
}

export interface EntryForFinancialAccount {
  creditAccount: string | null;
  debitAccount: string | null;
  creditAmount: number;
  debitAmount: number;
  creditAmountILS: number | null;
  debitAmountILS: number | null;
  reference1: string | null;
  reference2: string | null;
  description: string | null;
}

export interface EntryForAccounting {
  movementType: string | null;
  creditAccount: string | null;
  debitAccount: string | null;
  creditAmount: number | null;
  debitAmount: number | null;
  creditAmountILS: number;
  debitAmountILS: number;
  secondAccountCreditAmount?: number;
  secondAccountCreditAmountILS?: number;
  secondAccountDebitAmount?: number;
  secondAccountDebitAmountILS?: number;
  reference1: string | null;
  reference2: string | null;
  description: string | null;
}

export async function buildLedgerEntries(
  charge: VatExtendedCharge,
  originalAmount: number,
  hashVATIndexes: Record<VatIndexesKeys, string>,
): Promise<{
  entryForFinancialAccount: EntryForFinancialAccount;
  entryForAccounting: EntryForAccounting;
}> {
  const chargeAmount = parseFloat(charge.event_amount);

  // entryForFinancialAccount setup
  const entryForFinancialAccount: Partial<EntryForFinancialAccount> = {};

  entryForFinancialAccount.creditAccount = charge.financial_entity;
  entryForFinancialAccount.debitAccount = charge.account_type;

  entryForFinancialAccount.creditAmount = entryForFinancialAccount.debitAmount = chargeAmount;

  if (!charge.debit_date) {
    throw new Error(`Chare id=${charge.id} is missing debit date`);
  }

  const { debitExchangeRates, invoiceExchangeRates } = await getChargeExchangeRates(charge);

  entryForFinancialAccount.creditAmountILS = entryForFinancialAccount.debitAmountILS =
    charge.debit_date
      ? getILSForDate(charge, debitExchangeRates, chargeAmount).eventAmountILS
      : null;

  // entryForAccounting setup
  const entryForAccounting: Partial<EntryForAccounting> = {};

  entryForAccounting.movementType = null;

  entryForAccounting.creditAccount = charge.tax_category;
  entryForAccounting.debitAccount = charge.financial_entity;

  entryForAccounting.creditAmount = entryForAccounting.debitAmount = charge.tax_invoice_amount
    ? parseFloat(charge.tax_invoice_amount)
    : chargeAmount;

  entryForAccounting.creditAmountILS = entryForAccounting.debitAmountILS = getILSForDate(
    charge,
    charge.account_type == 'creditcard' ? debitExchangeRates : invoiceExchangeRates,
  ).eventAmountILS;

  if (charge.vatAfterDiduction && charge.vatAfterDiduction != 0) {
    entryForAccounting.secondAccountCreditAmount = charge.vatAfterDiduction;
    entryForAccounting.secondAccountCreditAmountILS = getILSForDate(
      charge,
      debitExchangeRates,
    ).vatAfterDiductionILS;
    entryForAccounting.creditAmount = charge.amountBeforeVAT;
    entryForAccounting.creditAmountILS = getILSForDate(
      charge,
      debitExchangeRates,
    ).amountBeforeVATILS;
    entryForAccounting.secondAccountDebitAmount =
      entryForAccounting.secondAccountDebitAmountILS = 0;
    entryForAccounting.movementType = hashVATIndexes.vatIncomesMovementTypeIndex;
    if (chargeAmount > 0) {
      entryForAccounting.creditAccount = hashVATIndexes.vatIncomesIndex;
    }
  } else if (charge.tax_category != 'אוריח') {
    entryForAccounting.movementType = hashVATIndexes.vatFreeIncomesMovementTypeIndex;

    if (chargeAmount > 0) {
      entryForAccounting.creditAccount = hashVATIndexes.vatFreeIncomesIndex;
    }
  }

  // more setup for both
  if (charge.tax_invoice_currency) {
    entryForFinancialAccount.creditAmountILS = entryForFinancialAccount.debitAmountILS =
      originalAmount;
  }
  entryForAccounting.reference2 = entryForFinancialAccount.reference2 = charge.bank_reference;
  entryForAccounting.reference1 = entryForFinancialAccount.reference1 = charge.tax_invoice_number;
  entryForAccounting.description = entryForFinancialAccount.description = charge.user_description;

  if (chargeAmount < 0) {
    swapObjectKeys(entryForAccounting, 'creditAccount', 'debitAccount');
    swapObjectKeys(entryForAccounting, 'creditAmount', 'debitAmount');
    swapObjectKeys(entryForAccounting, 'creditAmountILS', 'debitAmountILS');
    swapObjectKeys(entryForAccounting, 'secondAccountCreditAmount', 'secondAccountDebitAmount');
    swapObjectKeys(
      entryForAccounting,
      'secondAccountCreditAmountILS',
      'secondAccountDebitAmountILS',
    );
    swapObjectKeys(entryForAccounting, 'reference1', 'reference2');
    swapObjectKeys(entryForFinancialAccount, 'creditAccount', 'debitAccount');
    swapObjectKeys(entryForFinancialAccount, 'creditAmount', 'debitAmount');
    swapObjectKeys(entryForFinancialAccount, 'creditAmountILS', 'debitAmountILS');
    swapObjectKeys(entryForFinancialAccount, 'reference1', 'reference2');
    if (charge.vatAfterDiduction && charge.vatAfterDiduction != 0) {
      charge.tax_category == 'פלאפון'
        ? (entryForAccounting.movementType = 'פלא')
        : charge.is_property
        ? (entryForAccounting.movementType = hashVATIndexes.vatExpensesPropertyMovementTypeIndex)
        : (entryForAccounting.movementType = hashVATIndexes.vatExpensesMovementTypeIndex);
    } else {
      entryForAccounting.movementType = null;
    }
  }

  console.log({
    entryForAccounting,
    entryForFinancialAccount,
  });

  return {
    entryForAccounting: entryForAccounting as EntryForAccounting,
    entryForFinancialAccount: entryForFinancialAccount as EntryForFinancialAccount,
  };
}

export function swapObjectKeys(
  obj: Record<string | number | symbol, unknown>,
  key1: string | number | symbol,
  key2: string | number | symbol,
) {
  [obj[key1], obj[key2]] = [obj[key2], obj[key1]];
}

function parseIntRound(v: number) {
  return Math.trunc(v + Math.sign(v) / 2);
}

export function stringNumberRounded(number: string): number {
  return parseIntRound((parseFloat(number) + Number.EPSILON) * 100) / 100;
}

export function numberRounded(number: number): number {
  return parseIntRound((number + Number.EPSILON) * 100) / 100;
}

export function effectiveDateSuplement(transaction: IGetChargesByFinancialAccountNumbersResult) {
  if (transaction.account_type != 'creditcard') {
    if (transaction.debit_date) {
      return format(transaction.debit_date, 'yyyy-MM-dd') as TimelessDateString;
    }
    return format(transaction.event_date, 'yyyy-MM-dd') as TimelessDateString;
  }
  if (transaction.debit_date) {
    return format(transaction.debit_date, 'yyyy-MM-dd') as TimelessDateString;
  }
  if (transaction.currency_code == 'ILS') {
    return format(transaction.event_date, 'yyyy-MM-dd') as TimelessDateString;
  }
  return null;
}

export function isTimelessDateString(date: string): date is TimelessDateString {
  const parts = date.split('-');
  if (parts.length !== 3) {
    return false;
  }
  const [year, month, day] = parts;
  //year
  const yearNum = Number(year);
  if (Number.isNaN(yearNum) || yearNum < 2000 || yearNum > 2049) {
    return false;
  }
  // month
  const monthNum = Number(month);
  if (Number.isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    return false;
  }
  // day
  const dayNum = Number(day);
  if (Number.isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
    return false;
  }
  return true;
}

export function dateFormatValidation(date: Date | string) {
  if (typeof date === 'string') {
    if (isTimelessDateString(date)) {
      return date;
    }
    return null;
  }
  return date;
}
