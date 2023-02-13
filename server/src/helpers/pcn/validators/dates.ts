import { onlyDigitsValidator } from "./strings.js";

/**
 * validates string format is YYYYMM
 * @param {string} value YYYYMM
 * @returns {boolean}
 */
export const yearMonthValidator = (value: string): boolean => {
  try {
    if (value.length !== 6) {
      return false;
    }
    if (!onlyDigitsValidator(value)) {
      return false;
    }

    const yearS = value.substring(0, 4);
    const year = parseInt(yearS);
    if (year > 2050 || year < 1990) {
      return false;
    }

    const monthS = value.substring(4, 6);
    const month = parseInt(monthS);
    if (month > 12 || month < 1) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};
