import { format } from 'date-fns';
import { GraphQLError } from 'graphql';

import type { IGetConversionOtherSideResult } from '../__generated__/charges.types.mjs';
import { IGetExchangeRatesByDatesResult } from '../__generated__/exchange.types.mjs';
import type { IGetFinancialAccountsByAccountNumbersResult } from '../__generated__/financial-accounts.types.mjs';
import type { IGetFinancialEntitiesByIdsResult } from '../__generated__/financial-entities.types.mjs';
import type { IGetHashavshevetBusinessIndexesResult } from '../__generated__/hashavshevet.types.mjs';
import type { IInsertLedgerRecordsParams } from '../__generated__/ledger-records.types.mjs';
import { VatIndexesKeys } from '../providers/hashavshevet.mjs';
import { TIMELESS_DATE_REGEX, TimelessDateString } from '../scalars/index.js';
import { ENTITIES_WITHOUT_INVOICE_DATE, TAX_CATEGORIES_WITHOUT_INVOICE_DATE } from './constants.mjs';
import { getILSForDate } from './exchange.mjs';
import { EntryForAccounting, EntryForFinancialAccount, numberRounded, VatExtendedCharge } from './misc.mjs';

/* regex of dd/mm/yyyy */
const HASHAVSHEVET_DATE_REGEX =
  /^(?:(?:31(\/)(?:0[13578]|1[02]))\1|(?:(?:29|30)(\/)(?:0[1,3-9]|1[0-2])\2))(?:(?:1[6-9]|[2-9]\d)\d{2})$|^(?:29(\/)02\3(?:(?:(?:1[6-9]|[2-9]\d)(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00))))$|^(?:0[1-9]|1\d|2[0-8])(\/)(?:(?:0[1-9])|(?:1[0-2]))\4(?:(?:1[6-9]|[2-9]\d)\d{2})$/;

function date(date: Date | TimelessDateString): string | undefined {
  if (date instanceof Date) {
    return format(date, 'dd/MM/yyyy');
  }
  if (typeof date === 'string' && TIMELESS_DATE_REGEX.test(date)) {
    const parts = date.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return undefined;
}

function currency(currency: string): string | null {
  switch (currency) {
    case 'ILS':
      return null;
    case 'NIS':
      return null;
    case 'EUR':
      return 'אירו';
    case 'USD':
      return '$';
    case 'GBP':
      return 'לש';
    default:
      throw new GraphQLError(`Unknown currency type: ${currency}`);
  }
}

function getCreditcardAccount(financialAccounts: IGetFinancialAccountsByAccountNumbersResult, currency: string | null) {
  switch (currency) {
    case 'ILS':
      return financialAccounts.hashavshevet_account_ils;
    case 'NIS':
      return financialAccounts.hashavshevet_account_ils;
    case 'USD':
      return financialAccounts.hashavshevet_account_usd;
    case 'EUR':
      return financialAccounts.hashavshevet_account_eur;
    default:
      throw new GraphQLError(`Unknown currency - ${currency}`);
  }
}

function account(
  accountType: string | null,
  financialAccounts: IGetFinancialAccountsByAccountNumbersResult,
  hashBusinessIndexes: IGetHashavshevetBusinessIndexesResult,
  hashVATIndexes: Record<VatIndexesKeys, string>,
  currency: string | null,
  isracardHashIndex: string | null,
  transactionDescription: string | null
): string | null {
  switch (accountType) {
    case 'checking_ils':
      return financialAccounts.hashavshevet_account_ils;
    case 'checking_usd':
      return financialAccounts.hashavshevet_account_usd;
    case 'checking_eur':
      return financialAccounts.hashavshevet_account_eur;
    case 'creditcard':
      return getCreditcardAccount(financialAccounts, currency);
    case 'Isracard':
      console.log('isracardHashIndex', isracardHashIndex);
      return isracardHashIndex;
    default:
      if (
        hashBusinessIndexes &&
        !Object.values(hashVATIndexes).includes(accountType ?? '') &&
        hashBusinessIndexes.auto_tax_category != accountType
      ) {
        if (transactionDescription == 'הפקדה לפקדון') {
          return 'פקדון';
        }
        if (hashBusinessIndexes.hash_index) {
          return hashBusinessIndexes.hash_index;
        }

        return accountType ? accountType.substring(0, 15).trimEnd() : null;
      }
      return accountType ? accountType.substring(0, 15).trimEnd() : null;
  }
}

function number(rawNumber: unknown, options: { abs?: boolean } = { abs: false }): string | null {
  let parsed = Number.parseFloat(rawNumber as string);
  if (isNaN(parsed)) {
    return null;
  }
  if (options.abs) {
    parsed = Math.abs(parsed);
  }
  const formatted = parsed.toFixed(2);
  if (formatted == '0.00') {
    return null;
  }
  return formatted;
}

export const hashavshevetFormat = {
  date,
  number,
  account,
  currency,
};

/**
 *
 * @param raw - string date from hashavshevet, format dd/mm/yyyy
 * @returns string date in format yyyy-mm-dd
 */
export function parseDate(raw?: string) {
  if (!raw) {
    return null;
  }

  const isFormatted = HASHAVSHEVET_DATE_REGEX.test(raw);
  if (isFormatted) {
    const parts = raw.split('/');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  throw new GraphQLError(`Invalid Hashavshevet date format. expected dd/mm/yyyy, got: "${raw}"`);
}

export function generateEntryForAccountingValues(
  charge: VatExtendedCharge,
  entryForAccounting: EntryForAccounting,
  financialAccount: IGetFinancialAccountsByAccountNumbersResult,
  hashBusinessIndexes: IGetHashavshevetBusinessIndexesResult,
  hashVATIndexes: Record<VatIndexesKeys, string>,
  isracardHashIndex: string | null,
  owner: IGetFinancialEntitiesByIdsResult
): IInsertLedgerRecordsParams['ledgerRecord'][0] {
  const isILS = charge.currency_code === 'ILS';

  const unformattedInvoiceDate =
    !ENTITIES_WITHOUT_INVOICE_DATE.includes(charge.financial_entity ?? '') &&
    !TAX_CATEGORIES_WITHOUT_INVOICE_DATE.includes(charge.tax_category ?? '')
      ? charge.tax_invoice_date
      : charge.event_date; // add a check if should have an invoice but doesn't let user know;
  const invoiceDate: IInsertLedgerRecordsParams['ledgerRecord'][0]['invoiceDate'] = unformattedInvoiceDate
    ? hashavshevetFormat.date(unformattedInvoiceDate)
    : null;
  const debitAccount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['debitAccount1'] = hashavshevetFormat.account(
    entryForAccounting.debitAccount,
    financialAccount,
    hashBusinessIndexes,
    hashVATIndexes,
    charge.currency_code,
    isracardHashIndex,
    charge.bank_description
  );
  const debitAmount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['debitAmount1'] = hashavshevetFormat.number(
    entryForAccounting.debitAmountILS,
    { abs: true }
  );
  const foreignDebitAmount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['foreignDebitAmount1'] = !isILS
    ? hashavshevetFormat.number(entryForAccounting.debitAmount, { abs: true })
    : null;
  const currency: IInsertLedgerRecordsParams['ledgerRecord'][0]['currency'] = hashavshevetFormat.currency(
    charge.currency_code ?? 'NULL'
  );
  const creditAccount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['creditAccount1'] = hashavshevetFormat.account(
    entryForAccounting.creditAccount,
    financialAccount,
    hashBusinessIndexes,
    hashVATIndexes,
    charge.currency_code,
    isracardHashIndex,
    charge.bank_description
  );
  const creditAmount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['creditAmount1'] = hashavshevetFormat.number(
    entryForAccounting.creditAmountILS,
    { abs: true }
  );
  const foreignCreditAmount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['foreignCreditAmount1'] = !isILS
    ? hashavshevetFormat.number(entryForAccounting.creditAmount, { abs: true })
    : null;
  const debitAccount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['debitAccount2'] =
    entryForAccounting.secondAccountDebitAmount && entryForAccounting.secondAccountDebitAmount != 0
      ? charge.is_property
        ? hashVATIndexes.vatPropertyInputsIndex
        : hashVATIndexes.vatInputsIndex
      : null;
  const debitAmount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['debitAmount2'] =
    entryForAccounting.secondAccountDebitAmount
      ? hashavshevetFormat.number(entryForAccounting.secondAccountDebitAmountILS, { abs: true })
      : null;
  const foreignDebitAmount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['foreignDebitAmount2'] =
    entryForAccounting.secondAccountDebitAmount && !isILS
      ? hashavshevetFormat.number(entryForAccounting.secondAccountDebitAmount, { abs: true })
      : null;
  const creditAccount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['creditAccount2'] =
    entryForAccounting.secondAccountCreditAmount && entryForAccounting.secondAccountCreditAmount != 0
      ? hashVATIndexes.vatOutputsIndex
      : null;
  const creditAmount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['creditAmount2'] =
    entryForAccounting.secondAccountCreditAmountILS
      ? hashavshevetFormat.number(entryForAccounting.secondAccountCreditAmountILS, { abs: true })
      : null;
  const foreignCreditAmount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['foreignCreditAmount2'] =
    entryForAccounting.secondAccountCreditAmount && !isILS
      ? hashavshevetFormat.number(entryForAccounting.secondAccountCreditAmount, { abs: true })
      : null;
  const details: IInsertLedgerRecordsParams['ledgerRecord'][0]['details'] = entryForAccounting.description;
  const reference1: IInsertLedgerRecordsParams['ledgerRecord'][0]['reference1'] = entryForAccounting.reference1
    ? (entryForAccounting.reference1?.match(/\d+/g) || []).join('').slice(-9)
    : null; // TODO(Uri): add check on the db for it;
  const reference2: IInsertLedgerRecordsParams['ledgerRecord'][0]['reference2'] = entryForAccounting.reference2
    ? (entryForAccounting.reference2?.match(/\d+/g) || []).join('').slice(-9)
    : null; // TODO(Uri): add check on the db for it;
  const movementType: IInsertLedgerRecordsParams['ledgerRecord'][0]['movementType'] = entryForAccounting.movementType;

  const unformattedValueDate =
    charge.account_type == 'creditcard'
      ? charge.debit_date ?? !TAX_CATEGORIES_WITHOUT_INVOICE_DATE.includes(charge.tax_category ?? '')
        ? charge.tax_invoice_date
        : charge.event_date
      : charge.tax_invoice_date ?? charge.debit_date;
  const valueDate: IInsertLedgerRecordsParams['ledgerRecord'][0]['valueDate'] = unformattedValueDate
    ? hashavshevetFormat.date(unformattedValueDate)
    : null;
  const date3: IInsertLedgerRecordsParams['ledgerRecord'][0]['date3'] = charge.event_date
    ? hashavshevetFormat.date(charge.event_date)
    : null;
  const originalId: IInsertLedgerRecordsParams['ledgerRecord'][0]['originalId'] = charge.id;
  const origin: IInsertLedgerRecordsParams['ledgerRecord'][0]['origin'] = 'generated_accounting';
  const proformaInvoiceFile: IInsertLedgerRecordsParams['ledgerRecord'][0]['proformaInvoiceFile'] =
    charge.proforma_invoice_file;
  const business: IInsertLedgerRecordsParams['ledgerRecord'][0]['business'] = owner.id;
  const hashavshevetId: IInsertLedgerRecordsParams['ledgerRecord'][0]['hashavshevetId'] = null;
  const reviewed: IInsertLedgerRecordsParams['ledgerRecord'][0]['reviewed'] = false;

  const ledger: IInsertLedgerRecordsParams['ledgerRecord'][0] = {
    invoiceDate,
    debitAccount1,
    debitAmount1,
    foreignDebitAmount1,
    currency,
    creditAccount1,
    creditAmount1,
    foreignCreditAmount1,
    debitAccount2,
    debitAmount2,
    foreignDebitAmount2,
    creditAccount2,
    creditAmount2,
    foreignCreditAmount2,
    details,
    reference1,
    reference2,
    movementType,
    valueDate,
    date3,
    originalId,
    origin,
    proformaInvoiceFile,
    business,
    hashavshevetId,
    reviewed,
  };

  return ledger;
}

export function generateEntryForFinancialAccountValues(
  charge: VatExtendedCharge,
  entryForFinancialAccount: EntryForFinancialAccount,
  financialAccount: IGetFinancialAccountsByAccountNumbersResult,
  hashBusinessIndexes: IGetHashavshevetBusinessIndexesResult,
  hashVATIndexes: Record<VatIndexesKeys, string>,
  isracardHashIndex: string | null,
  owner: IGetFinancialEntitiesByIdsResult,
  conversionOtherSide?: IGetConversionOtherSideResult
): IInsertLedgerRecordsParams['ledgerRecord'][0] {
  const isILS = charge.currency_code === 'ILS';

  const foreignBalance = null;
  const currency: IInsertLedgerRecordsParams['ledgerRecord'][0]['currency'] = charge.currency_code
    ? hashavshevetFormat.currency(charge.currency_code)
    : null; // TODO(Uri): Check if it works for forgien creditcard in ILS
  // TODO(Uri): comented code is a never-completed experiment
  //   if (charge.financial_entity == 'Isracard' && originalInvoicedAmountAndCurrency) {
  //     const originalInvoicedAmountAndCurrency: any = await pool.query(`
  //     select tax_invoice_amount, tax_invoice_currency
  //     from accounter_schema.all_transactions
  //     where
  //       debit_date = to_date('${format(charge.event_date, 'YYYY-MM-DD')}', 'YYYY-MM-DD')
  //       and account_number = $$${charge.bank_reference}$$
  //       and tax_invoice_currency is not null;
  // `);
  //       foreignBalance = hashavshevetFormat.number(originalInvoicedAmountAndCurrency.tax_invoice_amount, {abs: true});
  //       currency = hashavshevetFormat.currency(originalInvoicedAmountAndCurrency.tax_invoice_currency);
  //   }

  const invoiceDate: IInsertLedgerRecordsParams['ledgerRecord'][0]['invoiceDate'] = charge.event_date
    ? hashavshevetFormat.date(charge.event_date)
    : null;
  const debitAccount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['debitAccount1'] = hashavshevetFormat.account(
    entryForFinancialAccount.debitAccount,
    financialAccount,
    hashBusinessIndexes,
    hashVATIndexes,
    charge.currency_code,
    isracardHashIndex,
    charge.bank_description
  );
  const debitAmount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['debitAmount1'] = hashavshevetFormat.number(
    entryForFinancialAccount.debitAmountILS,
    { abs: true }
  );
  const foreignDebitAmount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['foreignDebitAmount1'] = !isILS
    ? hashavshevetFormat.number(entryForFinancialAccount.debitAmount, { abs: true })
    : foreignBalance;
  const creditAccount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['creditAccount1'] = hashavshevetFormat.account(
    entryForFinancialAccount.creditAccount,
    financialAccount,
    hashBusinessIndexes,
    hashVATIndexes,
    charge.currency_code,
    isracardHashIndex,
    charge.bank_description
  );
  const creditAmount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['creditAmount1'] = hashavshevetFormat.number(
    entryForFinancialAccount.creditAmountILS,
    { abs: true }
  );
  const foreignCreditAmount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['foreignCreditAmount1'] = !isILS
    ? hashavshevetFormat.number(entryForFinancialAccount.creditAmount, { abs: true })
    : foreignBalance;
  const debitAccount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['debitAccount2'] = null; //  NOTE(Uri): Check for interest transactions (הכנרבמ)
  const debitAmount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['debitAmount2'] = null;
  const foreignDebitAmount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['foreignDebitAmount2'] = null;
  const creditAccount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['creditAccount2'] = null;
  const creditAmount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['creditAmount2'] = null;
  const foreignCreditAmount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['foreignCreditAmount2'] = null;
  const details: IInsertLedgerRecordsParams['ledgerRecord'][0]['details'] = entryForFinancialAccount.description;
  const reference1: IInsertLedgerRecordsParams['ledgerRecord'][0]['reference1'] = entryForFinancialAccount.reference1
    ? (entryForFinancialAccount.reference1?.match(/\d+/g) || []).join('').slice(-9)
    : null; // NOTE(Uri): add check on the db for it
  const reference2: IInsertLedgerRecordsParams['ledgerRecord'][0]['reference2'] = entryForFinancialAccount.reference2
    ? (entryForFinancialAccount.reference2?.match(/\d+/g) || []).join('').substr(-9)
    : null; // NOTE(Uri): add check on the db for it
  const movementType: IInsertLedgerRecordsParams['ledgerRecord'][0]['movementType'] = null;
  const valueDate: IInsertLedgerRecordsParams['ledgerRecord'][0]['valueDate'] =
    charge.debit_date || charge.event_date ? hashavshevetFormat.date(charge.debit_date ?? charge.event_date) : null;
  const date3: IInsertLedgerRecordsParams['ledgerRecord'][0]['date3'] = charge.event_date
    ? hashavshevetFormat.date(charge.event_date)
    : null;
  const originalId: IInsertLedgerRecordsParams['ledgerRecord'][0]['originalId'] = charge.id;
  const origin: IInsertLedgerRecordsParams['ledgerRecord'][0]['origin'] = 'generated_financial_account';
  const proformaInvoiceFile: IInsertLedgerRecordsParams['ledgerRecord'][0]['proformaInvoiceFile'] =
    charge.proforma_invoice_file;
  const business: IInsertLedgerRecordsParams['ledgerRecord'][0]['business'] = owner.id;
  const hashavshevetId: IInsertLedgerRecordsParams['ledgerRecord'][0]['hashavshevetId'] = null;
  const reviewed: IInsertLedgerRecordsParams['ledgerRecord'][0]['reviewed'] = false;

  const ledger: IInsertLedgerRecordsParams['ledgerRecord'][0] = {
    invoiceDate,
    debitAccount1,
    debitAmount1,
    foreignDebitAmount1,
    currency,
    creditAccount1,
    creditAmount1,
    foreignCreditAmount1,
    debitAccount2,
    debitAmount2,
    foreignDebitAmount2,
    creditAccount2,
    creditAmount2,
    foreignCreditAmount2,
    details,
    reference1,
    reference2,
    movementType,
    valueDate,
    date3,
    originalId,
    origin,
    proformaInvoiceFile,
    business,
    hashavshevetId,
    reviewed,
  };

  if (charge.is_conversion) {
    console.log('conversation!  ', conversionOtherSide);
    const chargeAmount = charge.event_amount ? parseFloat(charge.event_amount) : 0;

    if (chargeAmount > 0 && !isILS) {
      ledger.debitAmount1 = hashavshevetFormat.number(conversionOtherSide?.event_amount, { abs: true });
      ledger.creditAccount1 = null;
      ledger.creditAmount1 = null;
      ledger.foreignCreditAmount1 = null;
    } else if (chargeAmount < 0 && isILS) {
      ledger.debitAccount1 = null;
      ledger.debitAmount1 = null;
      ledger.foreignDebitAmount1 = null;
      ledger.currency = conversionOtherSide?.currency_code
        ? hashavshevetFormat.currency(conversionOtherSide.currency_code)
        : null;
      ledger.foreignCreditAmount1 = hashavshevetFormat.number(conversionOtherSide?.event_amount, { abs: true });
    } else if (chargeAmount > 0 && isILS) {
      ledger.foreignDebitAmount1 = hashavshevetFormat.number(conversionOtherSide?.event_amount, { abs: true });
      ledger.currency = conversionOtherSide?.currency_code
        ? hashavshevetFormat.currency(conversionOtherSide.currency_code)
        : null;
      ledger.creditAccount1 = null;
      ledger.creditAmount1 = null;
      ledger.foreignCreditAmount1 = null;
    } else if (chargeAmount < 0 && !isILS) {
      ledger.debitAccount1 = null;
      ledger.debitAmount1 = null;
      ledger.foreignDebitAmount1 = null;
      ledger.creditAmount1 = hashavshevetFormat.number(conversionOtherSide?.event_amount, { abs: true });
    }
  }

  return ledger;
}

export function generateEntryForExchangeRatesDifferenceValues(
  charge: VatExtendedCharge,
  entryForFinancialAccount: EntryForFinancialAccount,
  entryForAccounting: EntryForAccounting,
  financialAccount: IGetFinancialAccountsByAccountNumbersResult,
  hashBusinessIndexes: IGetHashavshevetBusinessIndexesResult,
  hashVATIndexes: Record<VatIndexesKeys, string>,
  isracardHashIndex: string | null,
  owner: IGetFinancialEntitiesByIdsResult,
  someNameFlag = false, // TODO: find suitable name for this flag
  debitExchangeRates?: IGetExchangeRatesByDatesResult,
  invoiceExchangeRates?: IGetExchangeRatesByDatesResult
): IInsertLedgerRecordsParams['ledgerRecord'][0] {
  const credit = hashavshevetFormat.account(
    parseFloat(charge.event_amount) < 0
      ? entryForFinancialAccount.debitAccount
      : entryForFinancialAccount.creditAccount,
    financialAccount,
    hashBusinessIndexes,
    hashVATIndexes,
    charge.currency_code,
    isracardHashIndex,
    charge.bank_description
  );

  const unformattedInvoiceDate = someNameFlag ? charge.tax_invoice_date : charge.event_date;
  const amount = hashavshevetFormat.number(
    someNameFlag
      ? numberRounded(getILSForDate(charge, debitExchangeRates).eventAmountILS) -
          numberRounded(getILSForDate(charge, invoiceExchangeRates).eventAmountILS)
      : entryForFinancialAccount.debitAmountILS ?? 0 - entryForAccounting.debitAmountILS,
    { abs: someNameFlag }
  );

  const invoiceDate: IInsertLedgerRecordsParams['ledgerRecord'][0]['invoiceDate'] = unformattedInvoiceDate
    ? hashavshevetFormat.date(unformattedInvoiceDate)
    : null;
  const debitAccount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['debitAccount1'] = someNameFlag
    ? credit
    : hashVATIndexes.hashCurrencyRatesDifferencesIndex;
  const debitAmount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['debitAmount1'] = amount;
  const foreignDebitAmount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['foreignDebitAmount1'] = null;
  const currency: IInsertLedgerRecordsParams['ledgerRecord'][0]['currency'] = hashavshevetFormat.currency('ILS');
  const creditAccount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['creditAccount1'] = someNameFlag
    ? hashVATIndexes.hashCurrencyRatesDifferencesIndex
    : credit;
  const creditAmount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['creditAmount1'] = amount;
  const foreignCreditAmount1: IInsertLedgerRecordsParams['ledgerRecord'][0]['foreignCreditAmount1'] =
    hashavshevetFormat.currency('ILS');
  const debitAccount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['debitAccount2'] = null; // Check for interest transactions (הכנרבמ)
  const debitAmount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['debitAmount2'] = null;
  const foreignDebitAmount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['foreignDebitAmount2'] = null;
  const creditAccount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['creditAccount2'] = null;
  const creditAmount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['creditAmount2'] = null;
  const foreignCreditAmount2: IInsertLedgerRecordsParams['ledgerRecord'][0]['foreignCreditAmount2'] = null;
  const details: IInsertLedgerRecordsParams['ledgerRecord'][0]['details'] = entryForFinancialAccount.description;
  const reference1: IInsertLedgerRecordsParams['ledgerRecord'][0]['reference1'] = entryForFinancialAccount.reference1
    ? (entryForFinancialAccount.reference1?.match(/\d+/g) || []).join('').substr(-9)
    : null; // add check on the db for it
  const reference2: IInsertLedgerRecordsParams['ledgerRecord'][0]['reference2'] = entryForFinancialAccount.reference2
    ? (entryForFinancialAccount.reference2?.match(/\d+/g) || []).join('').substr(-9)
    : null;
  const movementType: IInsertLedgerRecordsParams['ledgerRecord'][0]['movementType'] = null;
  const valueDate: IInsertLedgerRecordsParams['ledgerRecord'][0]['valueDate'] =
    charge.debit_date || charge.event_date ? hashavshevetFormat.date(charge.debit_date ?? charge.event_date) : null;
  const date3: IInsertLedgerRecordsParams['ledgerRecord'][0]['date3'] = charge.event_date
    ? hashavshevetFormat.date(charge.event_date)
    : null;
  const originalId: IInsertLedgerRecordsParams['ledgerRecord'][0]['originalId'] = charge.id;
  const origin: IInsertLedgerRecordsParams['ledgerRecord'][0]['origin'] = someNameFlag
    ? 'generated_invoice_rates_change'
    : 'generated_invoice_rates_change_invoice_currency';
  const proformaInvoiceFile: IInsertLedgerRecordsParams['ledgerRecord'][0]['proformaInvoiceFile'] =
    charge.proforma_invoice_file;
  const business: IInsertLedgerRecordsParams['ledgerRecord'][0]['business'] = owner.id;
  const hashavshevetId: IInsertLedgerRecordsParams['ledgerRecord'][0]['hashavshevetId'] = null;
  const reviewed: IInsertLedgerRecordsParams['ledgerRecord'][0]['reviewed'] = false;

  const ledger: IInsertLedgerRecordsParams['ledgerRecord'][0] = {
    invoiceDate,
    debitAccount1,
    debitAmount1,
    foreignDebitAmount1,
    currency,
    creditAccount1,
    creditAmount1,
    foreignCreditAmount1,
    debitAccount2,
    debitAmount2,
    foreignDebitAmount2,
    creditAccount2,
    creditAmount2,
    foreignCreditAmount2,
    details,
    reference1,
    reference2,
    movementType,
    valueDate,
    date3,
    originalId,
    origin,
    proformaInvoiceFile,
    business,
    hashavshevetId,
    reviewed,
  };

  return ledger;
}

//   uuidv4(),
