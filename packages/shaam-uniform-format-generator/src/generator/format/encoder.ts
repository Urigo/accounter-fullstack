/**
 * Fixed-width formatting utilities
 */

import { padLeft, padRight } from '../../format/padding.js';

/**
 * Formats a field value with specified width and alignment
 *
 * @param value - The value to format
 * @param width - Target field width
 * @param align - Alignment ('left' or 'right')
 * @param padChar - Character to use for padding (default: space)
 * @returns Formatted fixed-width string
 */
export function formatField(
  value: string,
  width: number,
  align: 'left' | 'right',
  padChar = ' ',
): string {
  if (align === 'left') {
    return padRight(value, width, padChar);
  }
  return padLeft(value, width, padChar);
}

/**
 * Encodes a value to fixed-width format with padding
 *
 * @param value - The value to encode
 * @param width - Target width
 * @param padChar - Padding character (default: space)
 * @param align - Alignment ('left' or 'right')
 * @returns Fixed-width encoded string
 */
export function encodeFixedWidth(
  value: string | number,
  width: number,
  padChar = ' ',
  align: 'left' | 'right' = 'left',
): string {
  const str = String(value);
  return formatField(str, width, align, padChar);
}

/**
 * Helper function to format numeric fields with zero padding
 */
export function formatNumericField(value: string, width: number): string {
  return padLeft(value, width, '0');
}
