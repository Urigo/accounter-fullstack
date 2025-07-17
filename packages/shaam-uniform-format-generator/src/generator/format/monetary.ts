/**
 * Utility functions for handling monetary amounts in SHAAM uniform format
 */

/**
 * Converts a number to SHAAM monetary format string
 * Format: [+/-][12 zero-padded digits][2 decimal digits] (total 15 characters)
 *
 * @param value - The numeric value to convert
 * @returns A 15-character string in SHAAM monetary format
 *
 * @example
 * formatMonetaryAmount(12.4) // returns "+00000000001240"
 * formatMonetaryAmount(-12.4) // returns "-00000000001240"
 * formatMonetaryAmount(0) // returns "+00000000000000"
 * formatMonetaryAmount(1234567890.99) // returns "+12345678909900"
 */
export function formatMonetaryAmount(value: number): string {
  // Handle edge case of zero
  if (value === 0) {
    return '+00000000000000';
  }

  // Determine sign
  const sign = value >= 0 ? '+' : '-';
  const absoluteValue = Math.abs(value);

  // Convert to cents (multiply by 100 and round to handle floating point precision)
  const cents = Math.round(absoluteValue * 100);

  // Convert to string and pad with zeros to 14 digits (since sign takes 1 character)
  const paddedCents = cents.toString().padStart(14, '0');

  return sign + paddedCents;
}

/**
 * Parses a SHAAM monetary format string back to a number
 *
 * @param monetaryString - The 15-character SHAAM monetary format string
 * @returns The numeric value
 *
 * @example
 * parseMonetaryAmount("+00000000001240") // returns 12.4
 * parseMonetaryAmount("-00000000001240") // returns -12.4
 * parseMonetaryAmount("+00000000000000") // returns 0
 */
export function parseMonetaryAmount(monetaryString: string): number {
  if (!monetaryString || monetaryString.length !== 15) {
    throw new Error(
      `Invalid monetary string: expected 15 characters, got ${monetaryString.length}`,
    );
  }

  const sign = monetaryString[0];
  const centsString = monetaryString.slice(1);

  if (sign !== '+' && sign !== '-') {
    throw new Error(`Invalid monetary string: first character must be + or -, got '${sign}'`);
  }

  if (!/^\d{14}$/.test(centsString)) {
    throw new Error(
      `Invalid monetary string: last 14 characters must be digits, got '${centsString}'`,
    );
  }

  const cents = parseInt(centsString, 10);
  const value = cents / 100;

  // Handle -0 case: return positive 0
  if (value === 0) {
    return 0;
  }

  return sign === '-' ? -value : value;
}

/**
 * Converts a number to SHAAM monetary format, allowing empty values
 *
 * @param value - The numeric value to convert (can be undefined/null)
 * @returns A 15-character string in SHAAM monetary format, or empty string if value is undefined/null
 */
export function formatOptionalMonetaryAmount(value: number | undefined | null): string {
  if (value === undefined || value === null) {
    return '';
  }
  return formatMonetaryAmount(value);
}

/**
 * Parses a SHAAM monetary format string back to a number, handling empty values
 *
 * @param monetaryString - The SHAAM monetary format string (can be empty)
 * @returns The numeric value, or undefined if the string is empty
 */
export function parseOptionalMonetaryAmount(monetaryString: string): number | undefined {
  if (!monetaryString || monetaryString.trim() === '') {
    return undefined;
  }
  return parseMonetaryAmount(monetaryString);
}
