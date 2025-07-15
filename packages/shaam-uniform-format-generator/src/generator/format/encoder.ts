/**
 * Fixed-width encoding utilities
 */

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

  if (str.length >= width) {
    return str.substring(0, width);
  }

  const padding = padChar.repeat(width - str.length);
  return align === 'left' ? str + padding : padding + str;
}
