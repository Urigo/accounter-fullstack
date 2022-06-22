import { Invoice, InvoiceReceipt, Proforma, Receipt } from '../__generated__/types';

export function isDocumentInvoice(doc: any): doc is Invoice {
  return (<Invoice>doc).__typename === 'Invoice';
}

export function isDocumentReceipt(doc: any): doc is Receipt {
  return (<Receipt>doc).__typename === 'Receipt';
}

export function isDocumentInvoiceReceipt(doc: any): doc is InvoiceReceipt {
  return (<InvoiceReceipt>doc).__typename === 'InvoiceReceipt';
}

export function isDocumentProforma(doc: any): doc is Proforma {
  return (<Proforma>doc).__typename === 'Proforma';
}
