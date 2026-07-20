import { isInvoice, isReceipt } from '../../documents/helpers/common.helper.js';
import type { Document, DocumentCharge, Transaction, TransactionCharge } from '../types.js';

/**
 * Classify a candidate charge into the shape the matching algorithm consumes.
 *
 * Mirrors the auto-match unmatched-charge semantics: a charge is only a valid
 * match candidate when it is transaction-based (has transactions but no receipt
 * documents) or document-based (has accounting documents but no transactions).
 * Matched charges (both sides) and empty charges (neither) return `null`.
 *
 * @param chargeId - Candidate charge UUID
 * @param transactions - All transactions on the charge
 * @param accountingDocuments - The charge's documents, pre-filtered to accounting documents
 * @returns A `TransactionCharge`/`DocumentCharge` for valid candidates, or `null`
 */
export function classifyCandidateCharge(
  chargeId: string,
  transactions: Transaction[] | null | undefined,
  accountingDocuments: Document[] | null | undefined,
): TransactionCharge | DocumentCharge | null {
  // Defensive: never assume the loaders handed us arrays
  const txs = transactions ?? [];
  const docs = accountingDocuments ?? [];

  const invoiceDocuments = docs.filter(doc => isInvoice(doc.type));
  const receiptDocuments = docs.filter(doc => isReceipt(doc.type));

  const hasTxs = txs.length > 0;
  const hasDocs = docs.length > 0;
  const hasInvoiceDocs = invoiceDocuments.length > 0;
  const hasReceiptDocs = receiptDocuments.length > 0;

  // Transaction-based candidate (mirrors unmatched transaction charge)
  if (hasTxs && !hasReceiptDocs) {
    return { chargeId, transactions: txs };
  }

  // Document-based candidate (accounting documents but no transactions)
  if (hasDocs && !hasTxs) {
    if (hasReceiptDocs) {
      return { chargeId, documents: receiptDocuments };
    }
    if (hasInvoiceDocs) {
      return { chargeId, documents: invoiceDocuments };
    }
    return { chargeId, documents: docs };
  }

  // Matched charges (both sides) and empty charges (neither) are not candidates
  return null;
}
