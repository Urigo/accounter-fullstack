import { IValidateChargesResult } from '../__generated__/charges.types.mjs';
import { Currency, MissingChargeInfo, ValidationData } from '../__generated__/types.mjs';
import { formatFinancialAmount } from './amount.mjs';

export function validateCharge(charge: IValidateChargesResult): ValidationData {
  const missingInfo: Array<MissingChargeInfo> = [];

  const invoicesCount = Number(charge.invoices_count) || 0;
  const receiptsCount = Number(charge.receipts_count) || 0;
  const isForeignExpense = Boolean(charge.is_foreign && Number(charge.event_amount) < 0);
  const canSettleWithReceipt = isForeignExpense && receiptsCount > 0;
  const documentsAreFine = charge.no_invoices || invoicesCount > 0 || canSettleWithReceipt;
  if (!documentsAreFine) {
    missingInfo.push(MissingChargeInfo.Documents);
  }

  const businessIsFine = Boolean(charge.financial_entity);
  if (!businessIsFine) {
    missingInfo.push(MissingChargeInfo.Counterparty);
  }

  const descriptionIsFine = Boolean(charge.user_description?.trim());
  if (!descriptionIsFine) {
    missingInfo.push(MissingChargeInfo.TransactionDescription);
  }

  const tagsAreFine = Boolean(charge.personal_category?.trim());
  if (!tagsAreFine) {
    missingInfo.push(MissingChargeInfo.Tags);
  }

  const vatIsFine = charge.is_foreign || charge.no_invoices || charge.vat == null;
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
