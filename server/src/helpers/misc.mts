import type { IGetChargesByIdsResult } from "../__generated__/charges.types.mjs";
import { TAX_CATEGORIES_WITH_NOT_FULL_VAT } from "./consts.mjs";

type DecoreatedCharge = IGetChargesByIdsResult & {
    vatAfterDiduction?: number | null;
    amountBeforeVAT?: number | null;
    amountBeforeFullVAT?: number | null;
}

export function decorateCharge(charge: IGetChargesByIdsResult): DecoreatedCharge {
    const decoreatedCharge: Partial<DecoreatedCharge> = {...charge};
    // if foriegn transaction, use receipt as invoice
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
        decoreatedCharge.event_amount = decoreatedCharge.tax_invoice_amount;
        if (decoreatedCharge.account_type == 'creditcard') {
          decoreatedCharge.account_type = 'checking_usd';
        } else {
          decoreatedCharge.debit_date = decoreatedCharge.tax_invoice_date;
        }
      }

      const amountToUse = parseFloat((decoreatedCharge.tax_invoice_amount ? decoreatedCharge.tax_invoice_amount : decoreatedCharge.event_amount) ?? '0');
  decoreatedCharge.vatAfterDiduction = !TAX_CATEGORIES_WITH_NOT_FULL_VAT.includes(decoreatedCharge.tax_category ?? '')
    ? decoreatedCharge.vat
    : ((decoreatedCharge.vat ?? 0) / 3) * 2;
    decoreatedCharge.vatAfterDiduction ??= 0;

  // TODO/URI: Add a check if there is vat and it's not equal for 17 percent, let us know
  decoreatedCharge.amountBeforeVAT = amountToUse - decoreatedCharge.vatAfterDiduction;

  decoreatedCharge.amountBeforeFullVAT = amountToUse - (decoreatedCharge.vat ?? 0);

  return decoreatedCharge as DecoreatedCharge;
}

interface EntryForFinancialAccount {
    creditAccount: string | null;
    debitAccount: string | null;
    creditAmount:  string | null;
    debitAmount:  string | null;

}

export function buildEntryForFinancialAccount(charge: IGetChargesByIdsResult) {
    const entryForFinancialAccount: Partial<EntryForFinancialAccount> = {};

    entryForFinancialAccount.creditAccount = charge.financial_entity;
  entryForFinancialAccount.debitAccount = charge.account_type;

  entryForFinancialAccount.creditAmount = entryForFinancialAccount.debitAmount = charge.event_amount;

  entryForFinancialAccount.creditAmountILS = entryForFinancialAccount.debitAmountILS = getILSForDate(
    transaction,
    debitExchangeRates
  ).eventAmountILS;

  if (charge.vatAfterDiduction && charge.vatAfterDiduction != 0) {
    entryForAccounting.secondAccountCreditAmount = charge.vatAfterDiduction;
    entryForAccounting.secondAccountCreditAmountILS = getILSForDate(
      transaction,
      debitExchangeRates
    ).vatAfterDiductionILS;
    entryForAccounting.creditAmount = charge.amountBeforeVAT;
    entryForAccounting.creditAmountILS = getILSForDate(transaction, debitExchangeRates).amountBeforeVATILS;
    entryForAccounting.secondAccountDebitAmount = entryForAccounting.secondAccountDebitAmountILS = 0;
    entryForAccounting.movementType = hashVATIndexes.vatIncomesMovementTypeIndex;
    if (charge.event_amount > 0) {
      entryForAccounting.creditAccount = hashVATIndexes.vatIncomesIndex;
    }
  } else if (charge.tax_category != 'אוריח') {
    entryForAccounting.movementType = hashVATIndexes.vatFreeIncomesMovementTypeIndex;

    if (charge.event_amount > 0) {
      entryForAccounting.creditAccount = hashVATIndexes.vatFreeIncomesIndex;
    }
  }

  if (charge.tax_invoice_currency) {
    entryForFinancialAccount.creditAmountILS = entryForFinancialAccount.debitAmountILS =
      originalcharge.event_amount;
  }
  entryForAccounting.reference2 = entryForFinancialAccount.reference2 = charge.bank_reference;
  entryForAccounting.reference1 = entryForFinancialAccount.reference1 = charge.tax_invoice_number;
  entryForAccounting.description = entryForFinancialAccount.description = charge.user_description;

  if (charge.event_amount < 0) {
    function swap(obj: any, key1: any, key2: any) {
      [obj[key1], obj[key2]] = [obj[key2], obj[key1]];
    }
    swap(entryForAccounting, 'creditAccount', 'debitAccount');
    swap(entryForAccounting, 'creditAmount', 'debitAmount');
    swap(entryForAccounting, 'creditAmountILS', 'debitAmountILS');
    swap(entryForAccounting, 'secondAccountCreditAmount', 'secondAccountDebitAmount');
    swap(entryForAccounting, 'secondAccountCreditAmountILS', 'secondAccountDebitAmountILS');
    swap(entryForAccounting, 'reference1', 'reference2');
    swap(entryForFinancialAccount, 'creditAccount', 'debitAccount');
    swap(entryForFinancialAccount, 'creditAmount', 'debitAmount');
    swap(entryForFinancialAccount, 'creditAmountILS', 'debitAmountILS');
    swap(entryForFinancialAccount, 'reference1', 'reference2');
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
}