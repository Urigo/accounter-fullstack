/**
 * String padding utilities for fixed-width formatting
 */

/**
 * Pads a string on the left (right-aligns the content)
 *
 * @param value - The string to pad
 * @param width - Target width
 * @param fill - Character to use for padding (default: space)
 * @returns Left-padded string
 */
export function padLeft(value: string, width: number, fill = ' '): string {
  if (value.length >= width) {
    return value.substring(0, width);
  }

  const padLength = width - value.length;
  const padding = fill.repeat(padLength);
  return padding + value;
}

/**
 * Pads a string on the right (left-aligns the content)
 *
 * @param value - The string to pad
 * @param width - Target width
 * @param fill - Character to use for padding (default: space)
 * @returns Right-padded string
 */
export function padRight(value: string, width: number, fill = ' '): string {
  if (value.length >= width) {
    return value.substring(0, width);
  }

  const padLength = width - value.length;
  const padding = fill.repeat(padLength);
  return value + padding;
}
