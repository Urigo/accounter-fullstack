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
