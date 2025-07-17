/**
 * Fixed-width decoding utilities
 */

/**
 * Decodes a fixed-width string value
 *
 * @param line - The line to decode from
 * @param start - Start position (0-based)
 * @param length - Field length
 * @returns Decoded and trimmed value
 */
export function decodeFixedWidth(line: string, start: number, length: number): string {
  return line.substring(start, start + length).trim();
}
