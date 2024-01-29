import type { CreditInvoice, Invoice, InvoiceReceipt, Proforma, Receipt } from '../gql/graphql.js';

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
