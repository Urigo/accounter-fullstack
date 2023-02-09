import { IValidateChargesResult } from '../__generated__/charges.types.mjs';
import { ValidationData } from '../__generated__/types.mjs';

export function extractValidationData(data: IValidateChargesResult): ValidationData {
  return {
    counterparty: data?.is_financial_entity ?? true,
    transactionDescription: data?.is_user_description ?? true,
    tags: data?.is_personal_category ?? true,
    vat: data?.is_vat ?? true,
    foreign: data?.is_foreign ?? false,
    invoices: data?.invoices_count ? Number(data.invoices_count) : 0,
    receipts: data?.receipts_count ? Number(data.receipts_count) : 0,
    ledgerRecords: data?.ledger_records_count ? Number(data.ledger_records_count) : 0,
  };
}

// returns TRUE if charge has all required information
export function validateCharge(charge: IValidateChargesResult): boolean {
  const invoicesCount = Number(charge.invoices_count) || 0;
  const receiptsCount = Number(charge.receipts_count) || 0;
  const isForeignExpense = Boolean(charge.is_foreign && Number(charge.event_amount) < 0);
  const canSettleWithReceipt = isForeignExpense && receiptsCount > 0;
  const documentsAreFine = charge.no_invoices || invoicesCount > 0 || canSettleWithReceipt;

  const businessIsFine = Boolean(charge.financial_entity);

  const descriptionIsFine = Boolean(charge.user_description?.trim());

  const tagsAreFine = Boolean(charge.personal_category?.trim());

  const vatIsFine = charge.is_foreign || charge.no_invoices || Boolean(charge.is_vat);

  const ledgerRecordsCount = Number(charge.ledger_records_count) || 0;
  const ledgerRecordsAreFine = ledgerRecordsCount > 0;

  const balanceIsFine = !charge.balance || Number(charge.balance) == 0;

  const allFine =
    documentsAreFine &&
    businessIsFine &&
    descriptionIsFine &&
    tagsAreFine &&
    vatIsFine &&
    ledgerRecordsAreFine &&
    balanceIsFine;
  return allFine;
}
