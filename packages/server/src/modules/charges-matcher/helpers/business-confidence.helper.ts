/**
 * Calculate confidence score based on business ID match
 * @param transactionBusinessId - Business ID from transaction (can be null)
 * @param documentBusinessId - Business ID from document (can be null)
 * @returns Confidence score: 1.0 (exact match), 0.5 (one or both null), 0.2 (mismatch)
 */
export function calculateBusinessConfidence(
  transactionBusinessId: string | null,
  documentBusinessId: string | null,
): number {
  // If either or both are null, return 0.5
  if (transactionBusinessId === null || documentBusinessId === null) {
    return 0.5;
  }

  // Both are non-null, check if they match
  if (transactionBusinessId === documentBusinessId) {
    return 1.0;
  }

  // Both are non-null but don't match
  return 0.2;
}
