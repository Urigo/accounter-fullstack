/**
 * Calculate confidence score based on currency match
 * @param transactionCurrency - Currency code from transaction
 * @param documentCurrency - Currency code from document
 * @returns 1.0 if same, 0.2 if one/both missing, 0.0 if different
 */
export function calculateCurrencyConfidence(
  transactionCurrency: string | null | undefined,
  documentCurrency: string | null | undefined,
): number {
  // Handle null/undefined/empty cases
  if (!transactionCurrency || !documentCurrency) {
    return 0.2;
  }

  // Case-insensitive comparison
  if (transactionCurrency.toUpperCase() === documentCurrency.toUpperCase()) {
    return 1.0;
  }

  return 0.0;
}
