import type { IGetTransactionsByIdsResult } from '../../../modules/transactions/types.js';

export function getTransactionDebitDate(transaction: IGetTransactionsByIdsResult) {
  return (
    transaction.debit_date_override ||
    transaction.debit_timestamp ||
    transaction.debit_date ||
    transaction.event_date
  );
}
