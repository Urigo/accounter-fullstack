import { Injector } from 'graphql-modules';
import type { IGetChargesByIdsResult } from '@modules/charges/types';
import { VatIndexesKeys } from '@modules/hashavshevet/providers/hashavshevet.provider.js';
import { TAX_CATEGORIES_WITH_NOT_FULL_VAT } from '@shared/constants';
import type {
  EntryForAccounting,
  EntryForFinancialAccount,
  VatExtendedCharge,
} from '@shared/types';
import { ExchangeProvider } from '../providers/exchange.provider.js';
import { getILSForDate } from './exchange.helper.js';

export function decorateCharge(charge: IGetChargesByIdsResult): VatExtendedCharge {
  const decoratedCharge: Partial<VatExtendedCharge> = { ...charge };

  // If foriegn transaction, can use receipt as invoice
  if (
    decoratedCharge.currency_code != 'ILS' &&
    !decoratedCharge.tax_invoice_date &&
    !decoratedCharge.tax_invoice_number &&
    !decoratedCharge.tax_invoice_file &&
    !decoratedCharge.proforma_invoice_file &&
    decoratedCharge.receipt_number &&
    decoratedCharge.receipt_date &&
    decoratedCharge.receipt_url &&
    decoratedCharge.receipt_image
  ) {
    decoratedCharge.tax_invoice_date = decoratedCharge.receipt_date;
    decoratedCharge.tax_invoice_number = decoratedCharge.receipt_number;
    decoratedCharge.tax_invoice_file = decoratedCharge.receipt_url;
    decoratedCharge.proforma_invoice_file = decoratedCharge.receipt_image;
  }

  // what is happening here?
  if (decoratedCharge.tax_invoice_currency) {
    decoratedCharge.currency_code = decoratedCharge.tax_invoice_currency;
    decoratedCharge.event_amount = decoratedCharge.tax_invoice_amount ?? undefined;
    if (decoratedCharge.account_type == 'creditcard') {
      decoratedCharge.account_type = 'checking_usd';
    } else {
      decoratedCharge.debit_date = decoratedCharge.tax_invoice_date;
    }
  }

  const amountToUse = parseFloat(
    (decoratedCharge.tax_invoice_amount || decoratedCharge.event_amount) ?? '0',
  );
  decoratedCharge.vatAfterDeduction = TAX_CATEGORIES_WITH_NOT_FULL_VAT.includes(
    decoratedCharge.tax_category ?? '',
  )
    ? ((decoratedCharge.vat ?? 0) / 3) * 2
    : decoratedCharge.vat ?? 0;

  // TODO(Uri): Add a check if there is vat and it's not equal for 17 percent, let us know
  decoratedCharge.amountBeforeVAT = amountToUse - decoratedCharge.vatAfterDeduction;

  decoratedCharge.amountBeforeFullVAT = amountToUse - (decoratedCharge.vat ?? 0);

  return decoratedCharge as VatExtendedCharge;
}

export function swapObjectKeys(
  obj: Record<string | number | symbol, unknown>,
  key1: string | number | symbol,
  key2: string | number | symbol,
) {
  [obj[key1], obj[key2]] = [obj[key2], obj[key1]];
}

export async function buildLedgerEntries(
  injector: Injector,
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

  const { debitExchangeRates, invoiceExchangeRates } = await injector
    .get(ExchangeProvider)
    .getChargeExchangeRates(charge);

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

  if (charge.vatAfterDeduction && charge.vatAfterDeduction != 0) {
    entryForAccounting.secondAccountCreditAmount = charge.vatAfterDeduction;
    entryForAccounting.secondAccountCreditAmountILS = getILSForDate(
      charge,
      debitExchangeRates,
    ).vatAfterDeductionILS;
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
    if (charge.vatAfterDeduction && charge.vatAfterDeduction != 0) {
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
