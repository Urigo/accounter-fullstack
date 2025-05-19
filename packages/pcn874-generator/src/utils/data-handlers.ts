import {
  headerCoreSchema,
  headerStrictSchema,
  headerTransformerSchema,
  transactionCoreSchema,
  transactionStrictSchema,
  transactionTransformerSchema,
} from '../schemas.js';
import type { Header, Options, Transaction } from '../types.js';
import { footerBuilder, headerBuilder, transactionBuilder } from './index.js';

export const digitsAdjuster = (value: string, length: number) => {
  return `${'0'.repeat(length)}${value}`.slice(-length);
};

export const cleanNonDigitChars = (value: string): string => {
  return value.replace(/\D/g, '');
};

export const addLeadingZeros = (value = 0, length: number): string => {
  const zeros = '0'.repeat(length);
  const stringNum = Math.abs(Math.round(value)).toString();
  const final = (zeros + stringNum).slice(-length);
  return final;
};

export const numToSignedString = (value: number, length: number): string => {
  const sign = value >= 0 ? '+' : '-';
  const paddedNum = addLeadingZeros(value, length);
  return `${sign}${paddedNum}`;
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
    if (!options.strict) {
      try {
        parsedHeader = headerTransformerSchema.parse(parsedHeader);
      } catch (e) {
        console.log(e);
        throw new Error('Error auto-fixing header');
      }
    }

    const validatedHeader = headerStrictSchema.parse(parsedHeader);

    return {
      header: headerBuilder(validatedHeader),
      footer: footerBuilder(validatedHeader),
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
    const entryTypeCompare = a.entryType.localeCompare(b.entryType);
    if (entryTypeCompare) {
      return entryTypeCompare;
    }
    const invoiceDateCompare = a.invoiceDate.localeCompare(b.invoiceDate);
    if (invoiceDateCompare) {
      return invoiceDateCompare;
    }
    const vatIdCompare = (a.vatId ?? '0').localeCompare(b.vatId ?? '0');
    if (vatIdCompare) {
      return vatIdCompare;
    }
    return a.invoiceSum > b.invoiceSum ? 1 : -1;
  });
}

export function transactionToString(transaction: Transaction, options: Options): string {
  try {
    const initiallyParsedTransaction = transactionCoreSchema.safeParse(transaction);
    if (!initiallyParsedTransaction.success) {
      throw new Error(initiallyParsedTransaction.error.format()._errors.join(', '));
    }
    let { data: parsedTransaction } = initiallyParsedTransaction;
    if (!options.strict) {
      try {
        parsedTransaction = transactionTransformerSchema.parse(parsedTransaction);
      } catch (e) {
        console.log(e);
        throw new Error('Error auto-fixing transaction');
      }
    }

    const validatedTransaction = transactionStrictSchema.parse(parsedTransaction);

    return transactionBuilder(validatedTransaction);
  } catch (e) {
    throw new Error(
      `Transaction validation error: ${(e as Error).message}\n\n${JSON.stringify(transaction)}`,
    );
  }
}
