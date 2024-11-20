import type { IGetDocumentsByChargeIdResult } from '../types.js';

export function isValidFinancialDoc(doc: IGetDocumentsByChargeIdResult): boolean {
  if (
    doc.type !== 'CREDIT_INVOICE' &&
    doc.type !== 'INVOICE' &&
    doc.type !== 'INVOICE_RECEIPT' &&
    doc.type !== 'RECEIPT'
  ) {
    return false;
  }
  if (
    !doc.debtor_id ||
    !doc.creditor_id ||
    !doc.date ||
    !doc.serial_number ||
    !doc.vat_amount ||
    !doc.total_amount ||
    !doc.charge_id ||
    !doc.currency_code
  ) {
    return false;
  }

  return true;
}
