import { Currency, MissingChargeInfo, ValidationData } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import type { ChargeRequiredWrapper } from '../providers/charges.provider.js';
import type { IValidateChargesResult } from '../types.js';

export function validateCharge(
  charge: ChargeRequiredWrapper<IValidateChargesResult>,
): ValidationData {
  const missingInfo: Array<MissingChargeInfo> = [];

  const invoicesCount = Number(charge.invoices_count) || 0;
  const receiptsCount = Number(charge.receipts_count) || 0;
  const isForeignExpense = !!charge.is_foreign && Number(charge.transactions_event_amount) < 0;
  const canSettleWithReceipt = isForeignExpense && receiptsCount > 0;
  const documentsAreFine = charge.no_invoices_required || invoicesCount > 0 || canSettleWithReceipt;
  if (!documentsAreFine) {
    missingInfo.push(MissingChargeInfo.Documents);
  }

  const businessIsFine = !!charge.counterparty_id;
  if (!businessIsFine) {
    missingInfo.push(MissingChargeInfo.Counterparty);
  }

  const descriptionIsFine = (charge.user_description?.trim().length ?? 0) > 0;
  if (!descriptionIsFine) {
    missingInfo.push(MissingChargeInfo.TransactionDescription);
  }

  // TODO(Gil): Re-enable tags after migration to new DB structure
  // const tagsAreFine = !!charge.personal_category?.trim();
  // if (!tagsAreFine) {
  //   missingInfo.push(MissingChargeInfo.Tags);
  // }

  const vatIsFine =
    charge.no_invoices_required ||
    (charge.documents_vat_amount != null && charge.documents_vat_amount != 0);
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
    // tagsAreFine &&
    vatIsFine &&
    ledgerRecordsAreFine &&
    balanceIsFine;

  return {
    isValid: allFine,
    missingInfo,
    balance: formatFinancialAmount(charge.balance, Currency.Ils),
  };
}
