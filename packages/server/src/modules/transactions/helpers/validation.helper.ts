import type { IGetTransactionsByIdsResult } from '../types.js';

export function basicTransactionsValidation(transaction: IGetTransactionsByIdsResult): boolean {
  if (!transaction.business_id) {
    return false;
  }
  if (!transaction.debit_date && !transaction.debit_date_override) {
    return false;
  }
  return true;
}
