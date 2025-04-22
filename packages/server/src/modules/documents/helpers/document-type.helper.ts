import { DocumentType } from '@shared/gql-types';

// TODO: qu: do we have something like this in the project already?

/**
 * Safely converts a database document_type to our DocumentType enum
 * @param dbType The document_type from the database
 * @returns The corresponding DocumentType enum value
 */
export function dbDocumentTypeToEnum(dbType: string | null | undefined): DocumentType {
  switch (dbType) {
    case 'INVOICE':
      return DocumentType.Invoice;
    case 'RECEIPT':
      return DocumentType.Receipt;
    case 'INVOICE_RECEIPT':
      return DocumentType.InvoiceReceipt;
    case 'CREDIT_INVOICE':
      return DocumentType.CreditInvoice;
    case 'PROFORMA':
      return DocumentType.Proforma;
    case 'OTHER':
      return DocumentType.Other;
    default:
      return DocumentType.Unprocessed;
  }
}
