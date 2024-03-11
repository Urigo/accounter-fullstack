import { EntryType } from '../index.js';
import type { Header, Options, Transaction } from '../types.js';

const onlyDigitsValidator = (value: string): boolean => {
  return !!value && /^\d+$/.test(value);
};

const idValidator = (value: string, length: number): boolean => {
  if (value.length !== length) {
    return false;
  }
  return onlyDigitsValidator(value);
};

const yearMonthValidator = (value: string): boolean => {
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

const getDateString = (): string => {
  const now = new Date();
  const year = now.getUTCFullYear().toString();
  const month = ('0' + (now.getUTCMonth() + 1)).slice(-2);
  const day = ('0' + now.getUTCDate()).slice(-2);
  return `${year}${month}${day}`;
};

const dateValidator = (value: string): boolean => {
  try {
    if (value.length !== 8) {
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

    const monthLength = month === 2 ? 29 : [4, 6, 9, 11].includes(month) ? 30 : 31;
    const dayS = value.substring(6, 8);
    const day = parseInt(dayS);
    if (day > monthLength || day < 1) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

export const headerValidator = (header: Header): Header => {
  if (!idValidator(header.licensedDealerId, 9)) {
    throw new Error(
      `Expected licensedDealerId to be 9 digits, received "${header.licensedDealerId}"`,
    );
  }

  if (!yearMonthValidator(header.reportMonth)) {
    throw new Error(
      `Expected reportMonth to be legit date formed as YYYYMM, received "${header.reportMonth}"`,
    );
  }

  header.generationDate ??= getDateString();
  if (!dateValidator(header.generationDate)) {
    throw new Error(
      `Expected generationDate to be legit date formed as YYYYMMDD, received "${header.generationDate}"`,
    );
  }

  if (header.salesRecordCount < 0) {
    throw new Error(`Expected salesRecordCount to be >= 0, received "${header.salesRecordCount}"`);
  }

  if (header.inputsCount < 0) {
    throw new Error(`Expected inputsCount to be >= 0, received "${header.inputsCount}"`);
  }

  return header;
};

export const transactionValidator = (transaction: Transaction, options: Options): Transaction => {
  switch (transaction.entryType) {
    case EntryType.SALE_REGULAR: {
      if (transaction.invoiceSum <= 5000) {
        transaction.vatId ??= '000000000';
      }
      break;
    }
    case EntryType.SALE_ZERO_OR_EXEMPT: {
      if (transaction.totalVat && transaction.totalVat !== 0) {
        if (options.strict) {
          throw new Error(
            `Transactions of entry type "SALE_ZERO_OR_EXEMPT" VAT should be 0, received "${transaction.totalVat}". Replacing with 0`,
          );
        }
        transaction.totalVat = 0;
      }

      if (transaction.invoiceSum <= 5000) {
        transaction.vatId ??= '000000000';
      }
      break;
    }
    case EntryType.SALE_UNIDENTIFIED_CUSTOMER: {
      if (transaction.vatId && transaction.vatId !== '000000000' && options.strict) {
        throw new Error(
          `Transactions of entry type "SALE_UNIDENTIFIED_CUSTOMER" should not include vatId, received "${transaction.vatId}".`,
        );
      }
      break;
    }
    case EntryType.SALE_UNIDENTIFIED_ZERO_OR_EXEMPT: {
      if (transaction.vatId && transaction.vatId !== '000000000' && options.strict) {
        throw new Error(
          `Transactions of entry type "SALE_UNIDENTIFIED_ZERO_OR_EXEMPT" should not include vatId, received "${transaction.vatId}".`,
        );
      }

      if (transaction.totalVat && transaction.totalVat !== 0) {
        if (options.strict) {
          throw new Error(
            `Transactions of entry type "SALE_UNIDENTIFIED_ZERO_OR_EXEMPT" VAT should be 0, received "${transaction.totalVat}". Replacing with 0`,
          );
        }
        transaction.totalVat = 0;
      }
      break;
    }
    case EntryType.SALE_EXPORT: {
      transaction.vatId ??= '999999999';
      if (transaction.totalVat && transaction.totalVat !== 0) {
        throw new Error(
          `Transactions of entry type "SALE_EXPORT" should not include totalVat, received "${transaction.totalVat}"`,
        );
      }
      break;
    }
    case EntryType.INPUT_PETTY_CASH: {
      if (transaction.vatId && transaction.vatId !== '000000000' && options.strict) {
        throw new Error(
          `Transactions of entry type "INPUT_PETTY_CASH" should not include vatId, received "${transaction.vatId}".`,
        );
      }

      const invoicesNum = transaction.refNumber ? parseInt(transaction.refNumber) : 0;
      if (Number.isNaN(invoicesNum) || invoicesNum === 0) {
        throw new Error(
          `On transactions of entry type "INPUT_PETTY_CASH", refNumber should reflect the number of invoices in the entry (hence > 0), received "${transaction.refNumber}"`,
        );
      }
      break;
    }
    case EntryType.INPUT_IMPORT: {
      if (transaction.refNumber && transaction.refNumber !== '000000000' && options.strict) {
        throw new Error(
          `Transactions of entry type "INPUT_IMPORT" should not include refNumber, received "${transaction.refNumber}".`,
        );
      }
      break;
    }
    case EntryType.INPUT_SINGLE_DOC_BY_LAW: {
      transaction.refNumber ??= '000000000';
      break;
    }
  }

  if (transaction.vatId && !idValidator(transaction.vatId, 9)) {
    throw new Error(`Expected vatId to be 9 digits, received "${transaction.vatId}"`);
  }

  if (!dateValidator(transaction.invoiceDate)) {
    throw new Error(
      `Expected invoiceDate to be legit date formed as YYYYMMDD, received "${transaction.invoiceDate}"`,
    );
  }

  transaction.refGroup ??= '0000';
  if (transaction.refGroup.length !== 4) {
    throw new Error(`Expected refGroup to be 4 chars long, received "${transaction.refGroup}"`);
  }

  if (!!transaction.refNumber && !idValidator(transaction.refNumber, 9)) {
    throw new Error(`Expected refNumber to be 9 digits, received "${transaction.refNumber}"`);
  }

  if (!!transaction.totalVat && transaction.totalVat < 0) {
    throw new Error(
      `Expected totalVat to be a positive number, received "${transaction.totalVat}"`,
    );
  }

  if (transaction.invoiceSum <= 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `Expected invoiceSum to be a positive number, received "${transaction.invoiceSum}"`,
    );
  }

  return transaction;
};
