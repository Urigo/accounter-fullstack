import { format } from 'date-fns';
import { Currency, MissingChargeInfo, ValidationData } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import type { TimelessDateString } from '@shared/types';
import type { IGetChargesByIdsResult, IValidateChargesResult } from '../types.js';

export function validateCharge(charge: IValidateChargesResult): ValidationData {
  const missingInfo: Array<MissingChargeInfo> = [];

  const invoicesCount = Number(charge.invoices_count) || 0;
  const receiptsCount = Number(charge.receipts_count) || 0;
  const isForeignExpense = !!charge.is_foreign && Number(charge.event_amount) < 0;
  const canSettleWithReceipt = isForeignExpense && receiptsCount > 0;
  const documentsAreFine = charge.no_invoices || invoicesCount > 0 || canSettleWithReceipt;
  if (!documentsAreFine) {
    missingInfo.push(MissingChargeInfo.Documents);
  }

  const businessIsFine = !!charge.financial_entity_id;
  if (!businessIsFine) {
    missingInfo.push(MissingChargeInfo.Counterparty);
  }

  const descriptionIsFine = (charge.user_description?.trim().length ?? 0) > 0;
  if (!descriptionIsFine) {
    missingInfo.push(MissingChargeInfo.TransactionDescription);
  }

  const tagsAreFine = !!charge.personal_category?.trim();
  if (!tagsAreFine) {
    missingInfo.push(MissingChargeInfo.Tags);
  }

  const vatIsFine =
    charge.is_foreign || charge.no_invoices || (charge.vat != null && charge.vat != 0);
  if (!vatIsFine) {
    missingInfo.push(MissingChargeInfo.Vat);
  }

  const ledgerRecordsCount = Number(charge.ledger_records_count) || 0;
  const ledgerRecordsAreFine = ledgerRecordsCount > 0;
  if (!ledgerRecordsAreFine) {
    missingInfo.push(MissingChargeInfo.LedgerRecords);
  }

  const balanceIsFine = !charge.balance || Number(charge.balance) == 0;
  if (!balanceIsFine) {
    missingInfo.push(MissingChargeInfo.Balance);
  }

  const allFine =
    documentsAreFine &&
    businessIsFine &&
    descriptionIsFine &&
    tagsAreFine &&
    vatIsFine &&
    ledgerRecordsAreFine &&
    balanceIsFine;

  return {
    isValid: allFine,
    missingInfo,
    balance: formatFinancialAmount(charge.balance, Currency.Ils),
  };
}

export function effectiveDateSupplement(transaction: IGetChargesByIdsResult) {
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
