import type {
  mutation_addDocument_oneOf_0_allOf_0_payment_items_ref_items,
  mutation_addExpense_oneOf_0_allOf_0_documentType,
} from '@accounter/green-invoice-graphql';
import { DocumentType } from '@shared/gql-types';

export function normalizeDocumentType(
  rawType?:
    | mutation_addExpense_oneOf_0_allOf_0_documentType
    | mutation_addDocument_oneOf_0_allOf_0_payment_items_ref_items
    | number
    | null,
): DocumentType {
  if (!rawType) {
    return DocumentType.Unprocessed;
  }

  if (typeof rawType === 'string' && rawType.startsWith('_')) {
    const int = parseInt(rawType.replace('_', ''));
    if (Number.isInteger(int)) {
      rawType = int;
    }
  }

  switch (rawType) {
    case 20:
      // חשבון / אישור תשלום
      return DocumentType.Invoice;
    case 300:
      // חשבונית עסקה
      return DocumentType.Proforma;
    case 305:
      // חשבונית מס
      return DocumentType.Invoice;
    case 320:
      // חשבונית מס\קבלה
      return DocumentType.InvoiceReceipt;
    case 330:
      // חשבונית זיכוי
      return DocumentType.CreditInvoice;
    case 400:
      // קבלה
      return DocumentType.Receipt;
    case 405:
      // קבלה על תרומה
      return DocumentType.Unprocessed;
    default:
      console.log(`Got a new document type from Green Invoice: ${rawType}`);
      return DocumentType.Unprocessed;
  }
}
