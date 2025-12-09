import { DocumentType } from '../../../shared/enums.js';
import { document_type } from '../types.js';

export function isInvoice(type: document_type): boolean {
  return (
    type === DocumentType.Invoice ||
    type === DocumentType.CreditInvoice ||
    type === DocumentType.InvoiceReceipt
  );
}

export function isReceipt(type: document_type): boolean {
  return type === DocumentType.Receipt || type === DocumentType.InvoiceReceipt;
}
