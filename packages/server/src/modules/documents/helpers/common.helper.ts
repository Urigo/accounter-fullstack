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

export function isAccountingDocument(
  type: document_type,
  includeProforma: boolean = false,
): boolean {
  return (
    type === DocumentType.Invoice ||
    type === DocumentType.CreditInvoice ||
    type === DocumentType.Receipt ||
    type === DocumentType.InvoiceReceipt ||
    (includeProforma && type === DocumentType.Proforma)
  );
}

export function getDocumentNameFromType(documentType: DocumentType): string {
  switch (documentType) {
    case DocumentType.Invoice:
      return 'Tax Invoice';
    case DocumentType.Proforma:
      return 'Proforma Invoice';
    case DocumentType.InvoiceReceipt:
      return 'Invoice / Receipt';
    case DocumentType.CreditInvoice:
      return 'Credit Note';
    case DocumentType.Receipt:
      return 'Receipt';
    case DocumentType.Other:
      return 'Misc Document';
    case DocumentType.Unprocessed:
      return 'Unprocessed Document';
    default:
      throw new Error(`Unsupported document type: ${documentType}`);
  }
}
