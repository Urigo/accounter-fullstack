import { DocumentType } from '../gql/graphql.js';

type DocWithTypename<T extends string> = { __typename?: T };

export function isDocumentInvoice(doc: unknown): doc is DocWithTypename<'Invoice'> {
  return (doc as DocWithTypename<'Invoice'>)?.__typename === 'Invoice';
}

export function isDocumentReceipt(doc: unknown): doc is DocWithTypename<'Receipt'> {
  return (doc as DocWithTypename<'Receipt'>)?.__typename === 'Receipt';
}

export function isDocumentInvoiceReceipt(doc: unknown): doc is DocWithTypename<'InvoiceReceipt'> {
  return (doc as DocWithTypename<'InvoiceReceipt'>)?.__typename === 'InvoiceReceipt';
}

export function isDocumentCreditInvoice(doc: unknown): doc is DocWithTypename<'CreditInvoice'> {
  return (doc as DocWithTypename<'CreditInvoice'>)?.__typename === 'CreditInvoice';
}

export function isDocumentProforma(doc: unknown): doc is DocWithTypename<'Proforma'> {
  return (doc as DocWithTypename<'Proforma'>)?.__typename === 'Proforma';
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
      return 'Other Document';
    case DocumentType.Unprocessed:
      return 'Unprocessed Document';
    default:
      throw new Error(`Unsupported document type: ${documentType}`);
  }
}
