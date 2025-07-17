/**
 * Fixed-width formatting utilities
 */

import { CRLF } from '../../format/newline.js';
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

/**
 * Joins an array of field values into a single record line with CRLF ending
 * This is used by individual record encoders to create their output
 *
 * @param fields - Array of formatted field values
 * @returns Single record line ending with CRLF
 */
export function joinFields(fields: string[]): string {
  return fields.join('') + CRLF;
}

/**
 * Joins an array of record lines that already have CRLF endings
 *
 * @param lines - Array of record lines to join (each line should already end with CRLF)
 * @returns Joined string
 */
export function joinRecords(lines: string[]): string {
  return lines.join('');
}

/**
 * Joins an array of record lines and adds CRLF to each line
 *
 * @param lines - Array of record lines to join (without CRLF endings)
 * @returns Joined string with CRLF line endings
 */
export function joinLinesWithCRLF(lines: string[]): string {
  return lines.map(line => line + CRLF).join('');
}

/**
 * Creates a complete SHAAM format file by joining records
 * This is the main function for assembling final file content
 *
 * @param records - Array of encoded record strings (each already ending with CRLF)
 * @returns Complete file content ready for output
 */
export function assembleFile(records: string[]): string {
  return joinRecords(records);
}
