import { headerCoreSchema, headerTransformerSchema } from '../schemas.js';
import type { Header, Options, Transaction } from '../types.js';
import {
  footerBuilder,
  headerBuilder,
  headerValidator,
  transactionBuilder,
  transactionValidator,
} from './index.js';

export const digitsAdjuster = (value: string, length: number) => {
  return `${'0'.repeat(length)}${value}`.slice(-length);
};

export const cleanNonDigitChars = (value: string): string => {
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

  if (transaction.allocationNumber) {
    const sanitizedNumber = cleanNonDigitChars(transaction.allocationNumber);
    if (
      options.strict &&
      (sanitizedNumber.length !== 9 ||
        sanitizedNumber.length !== transaction.allocationNumber.length)
    ) {
      throw new Error(
        `Expected Transaction allocation number to be of 9 digits, received "${transaction.allocationNumber}". ${
          sanitizedNumber.length > 9 ? `Using the last 9 digits.` : `Adding leading zeros.`
        }`,
      );
    }
    transaction.allocationNumber = digitsAdjuster(sanitizedNumber, 9);
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

export const headerInfoToHeaderAndFooterStrings = (
  header: Header,
  options: Options,
): { header: string; footer: string } => {
  try {
    const initiallyParsedHeader = headerCoreSchema.safeParse(header);
    if (!initiallyParsedHeader.success) {
      throw new Error(initiallyParsedHeader.error.format()._errors.join(', '));
    }
    let { data: parsedHeader } = initiallyParsedHeader;
    if (options.strict) {
      try {
        parsedHeader = headerTransformerSchema.parse(parsedHeader);
      } catch (e) {
        console.log(e);
        throw new Error('Error auto-fixing header');
      }
    }

    // clean and fill licensedDealerId
    if (parsedHeader.licensedDealerId && parsedHeader.licensedDealerId.length !== 9) {
      const sanitizedNumber = cleanNonDigitChars(parsedHeader.licensedDealerId);
      if (
        options.strict &&
        (sanitizedNumber.length !== 9 ||
          sanitizedNumber.length !== parsedHeader.licensedDealerId.length)
      ) {
        throw new Error(
          `Expected Header licensedDealerId to be of 9 digits, received "${
            parsedHeader.licensedDealerId
          }". ${sanitizedNumber.length > 9 ? `Using the last 9 digits.` : `Adding leading zeros.`}`,
        );
      }
      parsedHeader.licensedDealerId = digitsAdjuster(sanitizedNumber, 9);
    }

    // TODO: replace with Zod validation
    const validatedHeader = headerValidator(parsedHeader);

    return {
      header: headerBuilder(validatedHeader),
      footer: footerBuilder(header),
    };
  } catch (e) {
    throw new Error(`Header validation error: ${(e as Error).message}`);
  }
};

export function sortTransactions(transactions: Transaction[], options: Options) {
  if (!options.sort) {
    return transactions;
  }

  return transactions.sort((a, b) => {
    if (a.entryType > b.entryType) {
      return 1;
    }
    if (a.entryType < b.entryType) {
      return -1;
    }
    return a.invoiceDate > b.invoiceDate ? 1 : -1;
  });
}

export function transactionToString(transaction: Transaction, options: Options): string {
  try {
    const validatedTransaction = transactionHandler(transaction, options);
    return transactionBuilder(validatedTransaction);
  } catch (e) {
    throw new Error(
      `Transaction validation error: ${(e as Error).message}\n\n${JSON.stringify(transaction)}`,
    );
  }
}
