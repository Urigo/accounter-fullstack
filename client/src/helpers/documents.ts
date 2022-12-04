import { Invoice, InvoiceReceipt, Proforma, Receipt } from '../__generated__/types.js';

export function isDocumentInvoice(doc: unknown): doc is Invoice {
  return (<Invoice>doc)?.__typename === 'Invoice';
}

export function isDocumentReceipt(doc: unknown): doc is Receipt {
  return (<Receipt>doc)?.__typename === 'Receipt';
}

export function isDocumentInvoiceReceipt(doc: unknown): doc is InvoiceReceipt {
  return (<InvoiceReceipt>doc)?.__typename === 'InvoiceReceipt';
}

export function isDocumentProforma(doc: unknown): doc is Proforma {
  return (<Proforma>doc)?.__typename === 'Proforma';
}
