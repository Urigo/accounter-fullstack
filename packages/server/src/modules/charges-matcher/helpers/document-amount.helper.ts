/**
 * Document Amount Normalization
 *
 * Normalizes document amounts for comparison with transaction amounts.
 * Per specification (section 4.3.1):
 * 1. Start with absolute value of total_amount
 * 2. If business is creditor: negate
 * 3. If document type is CREDIT_INVOICE: negate
 */

/**
 * Document types from database schema
 */
export type DocumentType =
  | 'CREDIT_INVOICE'
  | 'INVOICE'
  | 'INVOICE_RECEIPT'
  | 'OTHER'
  | 'PROFORMA'
  | 'RECEIPT'
  | 'UNPROCESSED';

/**
 * Normalize document amount for comparison with transaction amount
 *
 * Per specification:
 * - Start with absolute value of total_amount
 * - If business is creditor (debtor is user): negate
 * - If document type is CREDIT_INVOICE: negate
 *
 * Examples:
 * - INVOICE, business debtor (creditor is user): |100| = 100
 * - INVOICE, business creditor (debtor is user): |100| * -1 = -100
 * - CREDIT_INVOICE, business debtor: |100| * -1 = -100
 * - CREDIT_INVOICE, business creditor: |100| * -1 * -1 = 100 (double negation)
 *
 * @param totalAmount - Raw total_amount from document (can be positive or negative)
 * @param isBusinessCreditor - Whether the business is the creditor (from business extraction)
 * @param documentType - Type of document
 * @returns Normalized amount (signed) for comparison with transaction amount
 *
 * @example
 * // Regular invoice where user is creditor (business owes user)
 * normalizeDocumentAmount(100, false, 'INVOICE') // Returns 100
 *
 * @example
 * // Regular invoice where user is debtor (user owes business)
 * normalizeDocumentAmount(100, true, 'INVOICE') // Returns -100
 *
 * @example
 * // Credit invoice where user is creditor (user owes business a refund)
 * normalizeDocumentAmount(100, false, 'CREDIT_INVOICE') // Returns -100
 *
 * @example
 * // Credit invoice where user is debtor (business owes user a refund)
 * normalizeDocumentAmount(100, true, 'CREDIT_INVOICE') // Returns 100 (double negation)
 */
export function normalizeDocumentAmount(
  totalAmount: number,
  isBusinessCreditor: boolean,
  documentType: DocumentType,
): number {
  // Step 1: Start with absolute value
  let normalizedAmount = Math.abs(totalAmount);

  // Step 2: If business is creditor (debtor is user), negate
  if (isBusinessCreditor) {
    normalizedAmount = -normalizedAmount;
  }

  // Step 3: If document type is CREDIT_INVOICE, negate
  if (documentType === 'CREDIT_INVOICE') {
    normalizedAmount = -normalizedAmount;
  }

  return normalizedAmount;
}
