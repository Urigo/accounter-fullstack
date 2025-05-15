/**
 * Pads or trims a string to match a specified length.
 * @param value - The input string to process
 * @param length - The target length
 * @param padChar - Character used for padding (default: '0')
 * @param alignRight - If true, right-aligns by padding left; otherwise left-aligns (default: true)
 * @returns The padded or trimmed string of exact length
 */
export const padOrTrim = (
  value: string,
  length: number,
  padChar = '0',
  alignRight = true,
): string => {
  if (value.length > length) {
    return value.slice(0, length);
  }
  return alignRight ? value.padStart(length, padChar) : value.padEnd(length, padChar);
};
