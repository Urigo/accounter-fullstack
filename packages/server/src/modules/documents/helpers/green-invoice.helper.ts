import type {
  mutation_addExpense_oneOf_0_allOf_0_documentType,
  query_searchDocuments_items_items_payment_items_ref_items,
} from '@accounter/green-invoice-graphql';
import { DocumentType } from '@shared/gql-types';

export function normalizeDocumentType(
  rawType?:
    | mutation_addExpense_oneOf_0_allOf_0_documentType
    | query_searchDocuments_items_items_payment_items_ref_items
    | number
    | null,
): DocumentType {
  if (!rawType) {
    return DocumentType.Unprocessed;
  }
  switch (rawType) {
    case 20:
    case '_20':
      // חשבון / אישור תשלום
      return DocumentType.Invoice;
    case 300:
    case '_300':
      // חשבונית עסקה
      return DocumentType.Proforma;
    case 305:
    case '_305':
      // חשבונית מס
      return DocumentType.Invoice;
    case 320:
    case '_320':
      // חשבונית מס\קבלה
      return DocumentType.InvoiceReceipt;
    case 330:
    case '_330':
      // חשבונית זיכוי
      return DocumentType.CreditInvoice;
    case 400:
    case '_400':
      // קבלה
      return DocumentType.Receipt;
    case 405:
    case '_405':
      // קבלה על תרומה
      return DocumentType.Unprocessed;
    default:
      console.log(`Got a new document type from Green Invoice: ${rawType}`);
      return DocumentType.Unprocessed;
  }
}
