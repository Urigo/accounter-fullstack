/**
 * Format a number as a string for pgtyped numeric columns
 *
 * @param value - Numeric value (number or string)
 * @returns String representation suitable for pgtyped numeric fields
 *
 * @remarks
 * - pgtyped expects numeric values as strings to preserve precision
 * - Handles both number and string inputs
 * - Preserves decimal precision without rounding
 * - Negative values are supported
 *
 * @throws {Error} If value cannot be converted to a valid numeric string
 *
 * @example
 * ```typescript
 * formatNumeric(100); // '100'
 * formatNumeric(100.50); // '100.5'
 * formatNumeric(-42.99); // '-42.99'
 * formatNumeric('123.45'); // '123.45'
 * ```
 */
export function formatNumeric(value: number | string): string {
  if (typeof value === 'string') {
    // Validate that string is a valid number
    if (!/^-?\d+(\.\d+)?$/.test(value.trim())) {
      throw new Error(`Invalid numeric string: "${value}"`);
    }
    return value.trim();
  }

  if (typeof value !== 'number' || !isFinite(value)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  return String(value);
}

/**
 * Format money amount as string (convenience wrapper for formatNumeric)
 *
 * @param amount - Money amount (typically in cents or smallest currency unit)
 * @returns String representation suitable for pgtyped
 *
 * @example
 * ```typescript
 * formatMoney(10050); // '10050' (e.g., $100.50 in cents)
 * formatMoney(-2599); // '-2599' (e.g., -$25.99 in cents)
 * ```
 */
export function formatMoney(amount: number | string): string {
  return formatNumeric(amount);
}

/**
 * Convert decimal amount to string preserving precision
 *
 * @param amount - Decimal amount
 * @param decimals - Number of decimal places (default: 2)
 * @returns String with fixed decimal places
 *
 * @example
 * ```typescript
 * formatDecimal(100.5, 2); // '100.50'
 * formatDecimal(42.123456, 4); // '42.1235'
 * formatDecimal(1000, 0); // '1000'
 * ```
 */
export function formatDecimal(amount: number, decimals: number = 2): string {
  if (!isFinite(amount)) {
    throw new Error(`Invalid decimal amount: ${amount}`);
  }

  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`Invalid decimals: ${decimals}. Must be non-negative integer.`);
  }

  return amount.toFixed(decimals);
}

/**
 * Parse a numeric string back to a number
 *
 * @param value - String representation of a number
 * @returns Parsed number
 *
 * @throws {Error} If value cannot be parsed as a number
 *
 * @example
 * ```typescript
 * parseNumeric('100.50'); // 100.5
 * parseNumeric('-42'); // -42
 * ```
 */
export function parseNumeric(value: string): number {
  const trimmed = value.trim();
  
  // Check for invalid patterns before parsing
  if (trimmed === '' || /\s/.test(trimmed.replace(/^\s+|\s+$/g, ''))) {
    throw new Error(`Cannot parse numeric value: ${value}`);
  }

  const num = Number(trimmed);

  if (isNaN(num)) {
    throw new Error(`Cannot parse numeric value: ${value}`);
  }

  // Additional validation: ensure the string didn't have invalid characters
  // that Number() silently ignored (like multiple decimal points)
  if (!/^-?\d*\.?\d+(e[+-]?\d+)?$/i.test(trimmed)) {
    throw new Error(`Cannot parse numeric value: ${value}`);
  }

  // Normalize -0 to +0 (JavaScript quirk)
  return num === 0 ? 0 : num;
}
