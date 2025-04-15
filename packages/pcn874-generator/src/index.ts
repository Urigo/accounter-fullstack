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

export * from './types.js';
