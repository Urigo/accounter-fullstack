import type { Currency } from '@shared/gql-types';
import type { IGetTransactionsByIdsResult } from '../types.js';
import { isTransactionsValid } from './validation.helper.js';

export function getTransactionsMeta(transactions: IGetTransactionsByIdsResult[]) {
  let transactionsAmount: number | null = null;
  const currenciesSet = new Set<Currency>();
  let invalidTransactions = false;

  transactions.map(t => {
    const amountAsNumber = Number(t.amount);
    const amount = Number.isNaN(amountAsNumber) ? null : amountAsNumber;
    if (amount != null) {
      transactionsAmount ??= 0;
      transactionsAmount += amount;
      currenciesSet.add(t.currency as Currency);
    }
    if (isTransactionsValid(t)) {
      invalidTransactions = true;
    }
  });

  const transactionsCurrencies = Array.from(currenciesSet);
  const transactionsCurrency =
    transactionsCurrencies.length === 1 ? transactionsCurrencies[0] : null;

  return {
    transactionsCount: transactions.length,
    transactionsAmount,
    transactionsCurrencies,
    transactionsCurrency,
    invalidTransactions,
  };
}
