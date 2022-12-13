import { Invoice, InvoiceReceipt, Proforma, Receipt } from '../gql/graphql.js';

export function isDocumentInvoice(doc: unknown): doc is Partial<Invoice> {
  return (<Invoice>doc)?.__typename === 'Invoice';
}

export function isDocumentReceipt(doc: unknown): doc is Partial<Receipt> {
  return (<Receipt>doc)?.__typename === 'Receipt';
}

export function isDocumentInvoiceReceipt(doc: unknown): doc is Partial<InvoiceReceipt> {
  return (<InvoiceReceipt>doc)?.__typename === 'InvoiceReceipt';
}

export function isDocumentProforma(doc: unknown): doc is Partial<Proforma> {
  return (<Proforma>doc)?.__typename === 'Proforma';
}
