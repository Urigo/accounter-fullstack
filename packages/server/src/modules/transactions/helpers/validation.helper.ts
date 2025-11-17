import type { IGetTransactionsByIdsResult } from '../types.js';

export function isTransactionsValid(transaction: IGetTransactionsByIdsResult): boolean {
  return !!(transaction.business_id && (transaction.debit_date || transaction.debit_date_override));
}
