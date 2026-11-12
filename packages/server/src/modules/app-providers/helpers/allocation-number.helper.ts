const ALLOCATION_NUMBER_LENGTH = 9;

/**
 * Derives the 9-digit allocation number (מספר הקצאה) from the raw value the OCR model copied off
 * the document. Some issuers print it on its own, others embed it as the last 9 digits of a longer
 * "Tax Authorities Code" (e.g. `20250101120000111123456789` → `123456789`).
 *
 * The slicing is done here rather than by the model: LLMs can't reliably count digit positions
 * in long numbers and tend to return a window shifted by one or more digits.
 */
export function normalizeAllocationNumber(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const digits = raw.replaceAll(/\D/g, '');
  if (digits.length < ALLOCATION_NUMBER_LENGTH) {
    return null;
  }
  return digits.slice(-ALLOCATION_NUMBER_LENGTH);
}
