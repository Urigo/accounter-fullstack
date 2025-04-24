import type { Header, Options, Transaction } from './types.js';
import {
  headerInfoToHeaderAndFooterStrings,
  sortTransactions,
  transactionToString,
} from './utils/index.js';

export const pcnGenerator = (
  headerInfo: Header,
  transactions: Transaction[],
  options: Options = {},
): string => {
  let textFile = '';

  const { header, footer } = headerInfoToHeaderAndFooterStrings(headerInfo, options);
  textFile += header;

  // sort transactions
  const sortedTransactions = sortTransactions(transactions, options);

  // handle transactions
  sortedTransactions.map(transaction => {
    textFile += transactionToString(transaction, options);
  });

  textFile += footer;
  return textFile;
};

export function validatePcn874(content: string): boolean {
  const lines = content.split('\n');
  if (lines.length < 3) {
    return false;
  }

  // TODO: this is a very basic validation, we should add more checks

  // validate header
  const header = lines[0];
  if (header.length !== 131) {
    return false;
  }
  if (header[0] !== 'O') {
    return false;
  }
  if (header[16] !== '1') {
    return false;
  }

  // validate footer
  const footer = lines[lines.length - 1];
  if (footer.length !== 10) {
    return false;
  }
  if (footer[0] !== 'X') {
    return false;
  }

  // validate transaction lines
  const transactionLines = lines.slice(1, -1);
  for (const line of transactionLines) {
    if (line.length !== 60) {
      return false;
    }
    if (!['C', 'H', 'I', 'K', 'L', 'M', 'P', 'R', 'S', 'T', 'Y'].includes(line[0])) {
      return false;
    }
  }

  return true;
}

export * from './types.js';
