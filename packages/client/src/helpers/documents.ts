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

/** First Strong Isolate / Pop Directional Isolate: keep a Hebrew name from reordering the arrow. */
const FSI = '⁨';
const PDI = '⁩';

function isolate(text: string): string {
  return `${FSI}${text}${PDI}`;
}

/**
 * Title and subtitle for the document viewer, e.g. `{ title: 'Tax Invoice 1042', subtitle: 'Acme
 * Ltd → Your Company Ltd' }`. A missing serial or party is simply left out, and an unknown type
 * falls back to "Document" instead of throwing like `getDocumentNameFromType`.
 */
export function getDocumentViewerLabels(input: {
  documentType?: DocumentType | null;
  serialNumber?: string | null;
  creditor?: { name: string } | null;
  debtor?: { name: string } | null;
}): { title: string; subtitle?: string } {
  let typeName: string | null = null;
  if (input.documentType) {
    try {
      typeName = getDocumentNameFromType(input.documentType);
    } catch {
      typeName = null;
    }
  }
  const title = [typeName ?? 'Document', input.serialNumber?.trim()].filter(Boolean).join(' ');

  const parties = [input.creditor?.name, input.debtor?.name]
    .map(name => name?.trim())
    .filter((name): name is string => !!name)
    .map(isolate);

  return parties.length > 0 ? { title, subtitle: parties.join(' → ') } : { title };
}
