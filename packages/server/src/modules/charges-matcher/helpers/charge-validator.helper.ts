import { DocumentType } from '../../../shared/enums.js';
import { isAccountingDocument } from '../../documents/helpers/common.helper.js';
import type { Document, Transaction } from '../types.js';

/**
 * Represents a charge with its associated transactions and documents
 */
interface Charge {
  id: string;
  owner_id: string | null;
  transactions?: Transaction[];
  documents?: Document[];
}

/**
 * Validate a charge is properly formed for matching
 * @throws Error with descriptive message if invalid
 */
export function validateChargeForMatching(charge: Charge): void {
  if (!charge) {
    throw new Error('Charge is required');
  }

  if (!charge.id) {
    throw new Error('Charge must have an ID');
  }

  if (!charge.owner_id) {
    throw new Error(`Charge ${charge.id} must have an owner_id`);
  }

  // Check if charge has data
  const hasTransactions = charge.transactions && charge.transactions.length > 0;
  const hasDocuments = charge.documents?.some(doc => isAccountingDocument(doc.type as DocumentType, true));

  if (!hasTransactions && !hasDocuments) {
    throw new Error(`Charge ${charge.id} has no transactions or documents - cannot be matched`);
  }
}

/**
 * Check if charge is matched (has both transactions and accounting documents)
 */
export function isChargeMatched(charge: Charge): boolean {
  const hasTransactions = charge.transactions && charge.transactions.length > 0;

  const hasAccountingDocs = charge.documents?.some(doc =>
    isAccountingDocument(doc.type as DocumentType, true),
  );

  return !!hasTransactions && !!hasAccountingDocs;
}

/**
 * Check if charge has only transactions (no accounting documents)
 */
export function hasOnlyTransactions(charge: Charge): boolean {
  const hasTransactions = charge.transactions && charge.transactions.length > 0;

  const hasAccountingDocs = charge.documents?.some(doc =>
    isAccountingDocument(doc.type as DocumentType, true),
  );

  return !!hasTransactions && !hasAccountingDocs;
}

/**
 * Check if charge has only accounting documents (no transactions)
 */
export function hasOnlyDocuments(charge: Charge): boolean {
  const hasTransactions = charge.transactions && charge.transactions.length > 0;

  const hasAccountingDocs = charge.documents?.some(doc =>
    isAccountingDocument(doc.type as DocumentType, true),
  );

  return !hasTransactions && !!hasAccountingDocs;
}

/**
 * Validate that a charge is unmatched (for matching operations)
 * @throws Error if charge is already matched
 */
export function validateChargeIsUnmatched(charge: Charge): void {
  validateChargeForMatching(charge);

  if (isChargeMatched(charge)) {
    throw new Error(
      `Charge ${charge.id} is already matched (has both transactions and accounting documents)`,
    );
  }
}
