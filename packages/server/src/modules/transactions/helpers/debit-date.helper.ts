import type { IGetTransactionsByIdsResult } from '@modules/transactions/types.js';

export function getTransactionDebitDate(transaction: IGetTransactionsByIdsResult) {
  return (
    transaction.debit_date_override ||
    transaction.debit_timestamp ||
    transaction.debit_date ||
    transaction.event_date
  );
}

export function getTransactionsMinDebitDate(
  transactions: {
    debit_date_override: Date | null;
    debit_timestamp: Date | null;
    debit_date: Date | null;
  }[],
): Date | null {
  const dates = transactions
    .map(t => t.debit_date_override || t.debit_timestamp || t.debit_date)
    .filter(date => !!date);
  if (!dates.length) {
    return null;
  }
  return dates.reduce((min, curr) => (curr < min ? curr : min));
}

export function getTransactionsMinEventDate(
  transactions: {
    event_date: Date | null;
  }[],
): Date | null {
  if (!transactions.length) {
    return null;
  }
  const dates = transactions.map(t => t.event_date).filter(date => !!date);
  if (!dates.length) {
    return null;
  }
  return dates.reduce((min, curr) => (curr < min ? curr : min));
}
