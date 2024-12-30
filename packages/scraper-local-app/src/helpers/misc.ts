export function camelCase(str: string) {
  const res = str
    .replace(/:/g, '_')
    .split('_')
    .map((word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1)))
    .join('');
  return res;
}

export function reverse(s: string) {
  return s.split('').reverse().join('');
}

/**
 *
 * @param numberDate
 * @returns
 * @throws Error if the number date is not in the format of YYYYMMDD
 * @example
 * convertNumberDateToString(20220101) // '2022-01-01'
 * convertNumberDateToString(2022011) // Error: Invalid number date
 */
export function convertNumberDateToString(numberDate: number) {
  if (numberDate < 10_000_000 || numberDate > 99_999_999) {
    throw new Error('Invalid number date');
  }
  const stringDate = numberDate.toString();
  const year = stringDate.substring(0, 4);
  const month = stringDate.substring(4, 6);
  const day = stringDate.substring(6, 8);
  return `${year}-${month}-${day}`;
}
