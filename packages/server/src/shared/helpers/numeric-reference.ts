const NORMALIZED_REFERENCE_MIN_DIGITS = 6;

/**
 * Strip everything but digits, then drop leading zeros — Poalim pads its references
 * and security keys with zeros inconsistently between the reference column and the
 * transaction description, so comparisons must happen on the normalized form.
 *
 * Returns null when the result is too short to be a meaningful reference (guards
 * against matching amounts, dates and other incidental digit runs).
 */
export function normalizeNumericReference(value: string): string | null {
  const digitsOnly = value.replace(/\D+/g, '');
  if (digitsOnly.length < NORMALIZED_REFERENCE_MIN_DIGITS) {
    return null;
  }

  const withoutLeadingZeros = digitsOnly.replace(/^0+/, '');
  if (withoutLeadingZeros.length < NORMALIZED_REFERENCE_MIN_DIGITS) {
    return null;
  }

  return withoutLeadingZeros;
}
