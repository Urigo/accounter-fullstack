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
