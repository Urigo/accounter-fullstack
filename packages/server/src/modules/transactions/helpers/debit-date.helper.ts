import type { IGetTransactionsByIdsResult } from '../types.js';

export function getTransactionDebitDate(transaction: IGetTransactionsByIdsResult) {
  return (
    transaction.debit_date_override ||
    transaction.debit_timestamp ||
    transaction.debit_date ||
    transaction.event_date
  );
}
