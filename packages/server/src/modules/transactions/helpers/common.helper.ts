import type { Currency } from '../../../shared/enums.js';
import {
  dateToTimelessDateString,
  maxTimelessDate,
  minTimelessDate,
} from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import type { IGetTransactionsByIdsResult } from '../types.js';
import { isTransactionsValid } from './validation.helper.js';

export type TransactionsMeta = {
  transactionsCount: number;
  transactionsAmount: number | null;
  transactionsCurrencies: Currency[];
  transactionsCurrency: Currency | null;
  invalidTransactions: boolean;
  transactionsMinDebitDate: TimelessDateString | null;
  transactionsMinEventDate: TimelessDateString | null;
  transactionsMaxDebitDate: TimelessDateString | null;
  transactionsMaxEventDate: TimelessDateString | null;
};

export function getTransactionsMeta(transactions: IGetTransactionsByIdsResult[]): TransactionsMeta {
  let transactionsAmount: number | null = null;
  const currenciesSet = new Set<Currency>();
  let invalidTransactions = false;
  let transactionsMinDebitDate: TimelessDateString | null = null;
  let transactionsMinEventDate: TimelessDateString | null = null;
  let transactionsMaxDebitDate: TimelessDateString | null = null;
  let transactionsMaxEventDate: TimelessDateString | null = null;

  const hasFee = transactions.some(t => t.is_fee);
  const onlyFee = transactions.every(t => t.is_fee);
  const hasSomeFeeTransactions = hasFee && !onlyFee;

  for (const t of transactions) {
    if ((hasSomeFeeTransactions && !t.is_fee) || !hasSomeFeeTransactions) {
      const amountAsNumber = Number(t.amount);
      const amount = Number.isNaN(amountAsNumber) ? null : amountAsNumber;
      if (amount != null) {
        transactionsAmount ??= 0;
        transactionsAmount += amount;
        currenciesSet.add(t.currency as Currency);
      }
    }

    // debit_timestamp (set for crypto rows) takes precedence over debit_date, the same way
    // `Transaction.effectiveDate` derives its day from it
    const debitDate = t.debit_timestamp
      ? dateToTimelessDateString(t.debit_timestamp)
      : t.debit_date;
    transactionsMinDebitDate = minTimelessDate(transactionsMinDebitDate, debitDate);
    transactionsMaxDebitDate = maxTimelessDate(transactionsMaxDebitDate, debitDate);

    transactionsMinEventDate = minTimelessDate(transactionsMinEventDate, t.event_date);
    transactionsMaxEventDate = maxTimelessDate(transactionsMaxEventDate, t.event_date);

    if (!isTransactionsValid(t)) {
      invalidTransactions = true;
    }
  }

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
    transactionsMaxDebitDate,
    transactionsMaxEventDate,
  };
}
