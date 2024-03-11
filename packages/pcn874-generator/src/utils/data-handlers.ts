import type { Header, Options, Transaction } from '../types.js';
import { headerValidator, transactionValidator } from './index.js';

const digitsAdjuster = (value: string, length: number) => {
  return `${'0'.repeat(length)}${value}`.slice(-length);
};

const cleanNonDigitChars = (value: string): string => {
  return value.replace(/\D/g, '');
};

export const transactionHandler = (transaction: Transaction, options: Options): Transaction => {
  if (transaction.refNumber) {
    const sanitizedNumber = cleanNonDigitChars(transaction.refNumber);
    if (
      options.strict &&
      (sanitizedNumber.length !== 9 || sanitizedNumber.length !== transaction.refNumber.length)
    ) {
      throw new Error(
        `Expected Transaction refNumber to be of 9 digits, received "${transaction.refNumber}". ${
          transaction.refNumber.length > 9 ? `Using the last 9 digits.` : `Adding leading zeros.`
        }`,
      );
    }
    transaction.refNumber = digitsAdjuster(sanitizedNumber, 9);
  }

  if (transaction.vatId) {
    const sanitizedNumber = cleanNonDigitChars(transaction.vatId);
    if (
      options.strict &&
      (sanitizedNumber.length !== 9 || sanitizedNumber.length !== transaction.vatId.length)
    ) {
      throw new Error(
        `Expected Transaction vatId to be of 9 digits, received "${transaction.vatId}". ${
          sanitizedNumber.length > 9 ? `Using the last 9 digits.` : `Adding leading zeros.`
        }`,
      );
    }
    transaction.vatId = digitsAdjuster(sanitizedNumber, 9);
  }

  if (transaction.refGroup) {
    const sanitizedNumber = cleanNonDigitChars(transaction.refGroup);
    if (
      options.strict &&
      (sanitizedNumber.length !== 4 || sanitizedNumber.length !== transaction.refGroup.length)
    ) {
      throw new Error(
        `Expected Transaction refGroup to be of 4 digits, received "${transaction.refGroup}". ${
          sanitizedNumber.length > 4 ? `Using the last 4 digits.` : `Adding leading zeros.`
        }`,
      );
    }
    transaction.refGroup = digitsAdjuster(sanitizedNumber, 4);
  }

  return transactionValidator(transaction, options);
};

export const headerHandler = (header: Header, options: Options): Header => {
  if (header.licensedDealerId && header.licensedDealerId.length !== 9) {
    const sanitizedNumber = cleanNonDigitChars(header.licensedDealerId);
    if (
      options.strict &&
      (sanitizedNumber.length !== 9 || sanitizedNumber.length !== header.licensedDealerId.length)
    ) {
      throw new Error(
        `Expected Header licensedDealerId to be of 9 digits, received "${
          header.licensedDealerId
        }". ${sanitizedNumber.length > 9 ? `Using the last 9 digits.` : `Adding leading zeros.`}`,
      );
    }
    header.licensedDealerId = digitsAdjuster(sanitizedNumber, 9);
  }

  return headerValidator(header);
};
