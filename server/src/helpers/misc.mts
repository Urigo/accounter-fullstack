import { format } from 'date-fns';

import type {
  IGetChargesByFinancialAccountNumbersResult,
  IGetChargesByIdsResult,
} from '../modules/charges/generated-types/charges.provider.types.mjs';
import { TAX_CATEGORIES_WITH_NOT_FULL_VAT } from './constants.mjs';

export type VatExtendedCharge = IGetChargesByIdsResult & {
  vatAfterDiduction: number;
  amountBeforeVAT: number;
  amountBeforeFullVAT: number;
};

export function decorateCharge(charge: IGetChargesByIdsResult, autoTaxCategory?: string | null): VatExtendedCharge {
  const decoreatedCharge: Partial<VatExtendedCharge> = { ...charge };

  decoreatedCharge.tax_category = autoTaxCategory ?? decoreatedCharge.tax_category;

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
    (decoreatedCharge.tax_invoice_amount ? decoreatedCharge.tax_invoice_amount : decoreatedCharge.event_amount) ?? '0'
  );
  decoreatedCharge.vatAfterDiduction = !TAX_CATEGORIES_WITH_NOT_FULL_VAT.includes(decoreatedCharge.tax_category ?? '')
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

export function swapObjectKeys(
  obj: Record<string | number | symbol, unknown>,
  key1: string | number | symbol,
  key2: string | number | symbol
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
  if (transaction.debit_date) {
    return format(transaction.debit_date, 'yyyy-MM-dd');
  }
  if (transaction.currency_code === 'ILS' && transaction.event_date && transaction.account_type === 'creditcard') {
    return format(transaction.event_date, 'yyyy-MM-dd');
  }
  return null;
}
