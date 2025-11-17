import type { Currency } from '@shared/gql-types';
import type { IGetTransactionsByIdsResult } from '../types.js';
import { isTransactionsValid } from './validation.helper.js';

export function getTransactionsMeta(transactions: IGetTransactionsByIdsResult[]) {
  let transactionsAmount: number | null = null;
  const currenciesSet = new Set<Currency>();
  let invalidTransactions = false;
  let transactionsMinDebitDate: Date | null = null;
  let transactionsMinEventDate: Date | null = null;

  transactions.map(t => {
    const amountAsNumber = Number(t.amount);
    const amount = Number.isNaN(amountAsNumber) ? null : amountAsNumber;
    if (amount != null) {
      transactionsAmount ??= 0;
      transactionsAmount += amount;
      currenciesSet.add(t.currency as Currency);
    }
    if (t.debit_timestamp) {
      transactionsMinDebitDate ??= t.debit_timestamp;
      if (transactionsMinDebitDate > t.debit_timestamp) {
        transactionsMinDebitDate = t.debit_timestamp;
      }
    } else if (t.debit_date) {
      transactionsMinDebitDate ??= t.debit_date;
      if (transactionsMinDebitDate > t.debit_date) {
        transactionsMinDebitDate = t.debit_date;
      }
    }

    transactionsMinEventDate ??= t.event_date;
    if (transactionsMinEventDate > t.event_date) {
      transactionsMinEventDate = t.event_date;
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
    transactionsMinDebitDate,
    transactionsMinEventDate,
  };
}
