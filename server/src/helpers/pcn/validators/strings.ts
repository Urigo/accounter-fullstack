/**
 * validates input contains only digits
 * @param {string} value
 * @returns {boolean}
 */
export const onlyDigitsValidator = (value: string): boolean => {
  return Boolean(value) && /^\d+$/.test(value);
};

/**
 * validates value is of exact length and contains only digit
 * @param {string} value
 * @param {number} length
 * @returns
 */
export const idValidator = (value: string, length: number): boolean => {
  if (value.length !== length) {
    return false;
  }
  return onlyDigitsValidator(value);
};
