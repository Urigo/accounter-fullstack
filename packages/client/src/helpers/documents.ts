import {
  DocumentType,
  type CreditInvoice,
  type Invoice,
  type InvoiceReceipt,
  type Proforma,
  type Receipt,
} from '../gql/graphql.js';

export function isDocumentInvoice(doc: unknown): doc is Partial<Invoice> {
  return (doc as Invoice)?.__typename === 'Invoice';
}

export function isDocumentReceipt(doc: unknown): doc is Partial<Receipt> {
  return (doc as Receipt)?.__typename === 'Receipt';
}

export function isDocumentInvoiceReceipt(doc: unknown): doc is Partial<InvoiceReceipt> {
  return (doc as InvoiceReceipt)?.__typename === 'InvoiceReceipt';
}

export function isDocumentCreditInvoice(doc: unknown): doc is Partial<CreditInvoice> {
  return (doc as CreditInvoice)?.__typename === 'CreditInvoice';
}

export function isDocumentProforma(doc: unknown): doc is Partial<Proforma> {
  return (doc as Proforma)?.__typename === 'Proforma';
}

export function getDocumentNameFromType(documentType: DocumentType): string {
  switch (documentType) {
    case DocumentType.Invoice:
      return 'Invoice';
    case DocumentType.Proforma:
      return 'Proforma Invoice';
    case DocumentType.InvoiceReceipt:
      return 'Invoice / Receipt';
    case DocumentType.CreditInvoice:
      return 'Credit Note';
    case DocumentType.Receipt:
      return 'Receipt';
    default:
      throw new Error(`Unsupported document type: ${documentType}`);
  }
}
