/**
 * The Israeli check digit of identity, company and tax-file numbers (SPEC §4.2, §15 A-25), which
 * SHAAM's structure checker enforces on every id9 and shareholderId field.
 */

/** Width every identifier is left-padded to before the check. */
const ID_WIDTH = 9;
const ONE_TO_NINE_DIGITS = /^\d{1,9}$/;

/**
 * True when `value` (1–9 digits, left-padded with zeros to 9) passes the check: digits weighted
 * alternately 1, 2, 1, 2, … from the left, products above 9 replaced by the sum of their digits,
 * total divisible by 10. Anything that is not 1–9 digits is false.
 */
export function isValidIsraeliCheckDigit(value: string): boolean {
  if (!ONE_TO_NINE_DIGITS.test(value)) {
    return false;
  }
  let total = 0;
  for (const [index, char] of [...value.padStart(ID_WIDTH, '0')].entries()) {
    const product = Number(char) * (index % 2 === 0 ? 1 : 2);
    total += product > 9 ? product - 9 : product;
  }
  return total % 10 === 0;
}
