import { mutation_addExpense_oneOf_0_allOf_0_documentType } from '@accounter-toolkit/green-invoice-graphql';

import { DocumentType } from '../__generated__/types.mjs';

export function normalizeDocumentType(rawType?: mutation_addExpense_oneOf_0_allOf_0_documentType | null): DocumentType {
  if (!rawType) {
    return DocumentType.Unprocessed;
  }
  switch (rawType) {
    case '_20':
      // חשבון / אישור תשלום
      return DocumentType.Invoice;
    case '_305':
      // חשבונית מס
      return DocumentType.Invoice;
    case '_320':
      // חשבונית מס\קבלה
      return DocumentType.InvoiceReceipt;
    case '_330':
      // חשבונית זיכוי
      return DocumentType.Unprocessed;
    case '_400':
      // קבלה
      return DocumentType.Receipt;
    case '_405':
      // קבלה על תרומה
      return DocumentType.Unprocessed;
    default:
      console.log(`Got a new document type from Green Invoice: ${rawType}`);
      return DocumentType.Unprocessed;
  }
}
