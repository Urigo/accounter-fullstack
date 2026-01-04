/**
 * Document Aggregator
 *
 * Aggregates multiple documents from a single charge into a unified representation
 * for matching purposes. Handles type priority filtering, business extraction,
 * amount normalization, currency validation, date selection, and description concatenation.
 */

import { DocumentType } from '../../../shared/enums.js';
import { isAccountingDocument } from '../../documents/helpers/common.helper.js';
import { currency, document_type } from '../../documents/types.js';
import { normalizeDocumentAmount } from '../helpers/document-amount.helper.js';
import { extractDocumentBusiness } from '../helpers/document-business.helper.js';
import { AggregatedDocument } from '../types.js';

/**
 * Minimal document interface for aggregation
 * Based on database schema from accounter_schema.documents
 * Note: Documents use charge_id for the FK
 */
export interface Document {
  id: string; // UUID
  charge_id: string | null; // UUID (actual FK name in DB)
  creditor_id: string | null; // UUID
  debtor_id: string | null; // UUID
  currency_code: currency | null; // Currency type
  date: Date | null;
  total_amount: number | null; // double precision in DB
  type: document_type;
  serial_number: string | null;
  image_url: string | null;
  file_url: string | null;
}

/**
 * Accounting document types (used for type priority filtering)
 */
const INVOICE_TYPES: DocumentType[] = [DocumentType.Invoice, DocumentType.CreditInvoice];
const RECEIPT_TYPES: DocumentType[] = [DocumentType.Receipt, DocumentType.InvoiceReceipt];

/**
 * Check if document type is an invoice or credit invoice
 */
function isInvoiceType(type: DocumentType): boolean {
  return INVOICE_TYPES.includes(type);
}

/**
 * Check if document type is a receipt or invoice-receipt
 */
function isReceiptType(type: DocumentType): boolean {
  return RECEIPT_TYPES.includes(type);
}

/**
 * Aggregate multiple documents into a single representation
 *
 * Per specification (section 4.2):
 * 1. Filter by type priority: if both invoices AND receipts exist, use only invoices
 * 2. Extract business ID from each document (creditor_id/debtor_id)
 * 3. Normalize each amount based on business role and document type
 * 4. Validate non-empty array
 * 5. Check for mixed currencies → throw error
 * 6. Check for multiple non-null business IDs → throw error
 * 7. Sum all normalized amounts
 * 8. Select latest date
 * 9. Concatenate serial_number or file names with line breaks
 * 10. Determine document type for result (use first after filtering)
 *
 * @param documents - Array of documents from a charge (use charge_id field for FK)
 * @param adminBusinessId - Current admin business UUID for business extraction
 * @returns Aggregated document data
 *
 * @throws {Error} If documents array is empty
 * @throws {Error} If multiple different currencies exist
 * @throws {Error} If multiple different non-null business IDs exist
 * @throws {Error} If business extraction fails (propagates from extractDocumentBusiness)
 * @throws {Error} If no valid date found in any document
 *
 * @example
 * const aggregated = aggregateDocuments([
 *   { total_amount: 100, currency_code: 'USD', creditor_id: 'b1', debtor_id: 'u1', type: DocumentType.Invoice, ... },
 *   { total_amount: 50, currency_code: 'USD', creditor_id: 'b1', debtor_id: 'u1', type: DocumentType.Invoice, ... }
 * ], 'u1');
 * // Returns aggregated with normalized amounts summed
 */
export function aggregateDocuments(
  documents: Document[],
  adminBusinessId: string,
): Omit<AggregatedDocument, 'businessIsCreditor'> {
  const accountingDocuments = documents.filter(doc => isAccountingDocument(doc.type, true));
  // Validate non-empty input
  if (!accountingDocuments || accountingDocuments.length === 0) {
    throw new Error('Cannot aggregate documents: array is empty');
  }

  // Apply type priority filtering
  const hasInvoices = accountingDocuments.some(d => isInvoiceType(d.type as DocumentType));
  const hasReceipts = accountingDocuments.some(d => isReceiptType(d.type as DocumentType));

  let filteredDocuments = accountingDocuments;
  if (hasInvoices && hasReceipts) {
    // If both invoices and receipts exist, use only invoices
    filteredDocuments = accountingDocuments.filter(d => isInvoiceType(d.type as DocumentType));
  }

  // Validate we still have documents after filtering
  if (filteredDocuments.length === 0) {
    throw new Error('Cannot aggregate documents: no valid documents after type priority filtering');
  }

  // Extract business info and normalize amounts for each document
  const processedDocuments = filteredDocuments.map(doc => {
    const businessInfo = extractDocumentBusiness(doc.creditor_id, doc.debtor_id, adminBusinessId);
    const normalizedAmount = normalizeDocumentAmount(
      doc.total_amount ?? 0,
      businessInfo.isBusinessCreditor,
      doc.type as DocumentType,
    );

    return {
      document: doc,
      businessInfo,
      normalizedAmount,
    };
  });

  // Validate single currency
  const currencies = new Set(
    processedDocuments
      .map(p => p.document.currency_code)
      .filter((code): code is currency => code !== null && code !== undefined),
  );

  if (currencies.size === 0) {
    throw new Error('Cannot aggregate documents: all documents have null currency_code');
  }

  if (currencies.size > 1) {
    throw new Error(
      `Cannot aggregate documents: multiple currencies found (${Array.from(currencies).join(', ')})`,
    );
  }

  // Validate single non-null business ID
  const businessIds = processedDocuments
    .map(p => p.businessInfo.businessId)
    .filter((id): id is string => id !== null && id !== undefined);

  const uniqueBusinessIds = new Set(businessIds);
  if (uniqueBusinessIds.size > 1) {
    throw new Error(
      `Cannot aggregate documents: multiple business IDs found (${Array.from(uniqueBusinessIds).join(', ')})`,
    );
  }

  // Sum normalized amounts
  const totalAmount = processedDocuments.reduce((sum, p) => sum + p.normalizedAmount, 0);

  // Get common currency (safe since we validated single currency)
  const currency = Array.from(currencies)[0];

  // Get business ID (single non-null or null if all null)
  const businessId = uniqueBusinessIds.size === 1 ? Array.from(uniqueBusinessIds)[0] : null;

  // Get latest date
  const dates = filteredDocuments
    .map(d => d.date)
    .filter((date): date is Date => date !== null && date !== undefined);

  if (dates.length === 0) {
    throw new Error('Cannot aggregate documents: all documents have null date');
  }

  const latestDate = dates.reduce((latest, d) => {
    return d > latest ? d : latest;
  }, dates[0]);

  // Concatenate descriptions (serial numbers, file names, or IDs)
  const descriptions = filteredDocuments
    .map(d => {
      // Prefer serial_number, fallback to file_url or image_url name, or document ID
      if (d.serial_number && d.serial_number.trim() !== '') {
        return d.serial_number.trim();
      }
      if (d.file_url) {
        // Extract filename from URL
        const fileName = d.file_url.split('/').pop() || d.file_url;
        return fileName;
      }
      if (d.image_url) {
        // Extract filename from URL
        const fileName = d.image_url.split('/').pop() || d.image_url;
        return fileName;
      }
      // Fallback to document ID
      return `Doc-${d.id.substring(0, 8)}`;
    })
    .filter(desc => desc !== null && desc !== undefined && desc.trim() !== '');

  const description = descriptions.length > 0 ? descriptions.join('\n') : '';

  // Determine document type (use first document after filtering)
  const type = filteredDocuments[0].type;

  return {
    amount: totalAmount,
    currency,
    businessId,
    date: latestDate,
    type,
    description,
  };
}
