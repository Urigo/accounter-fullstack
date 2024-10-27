import { dateToTimelessDateString } from '@shared/helpers';
import type { IGetTransactionsByIdsResult } from '../types.js';

export function effectiveDateSupplement(transaction: IGetTransactionsByIdsResult) {
  if (transaction.debit_timestamp) {
    return dateToTimelessDateString(transaction.debit_timestamp);
  }
  if (transaction.debit_date) {
    return dateToTimelessDateString(transaction.debit_date);
  }
  // if currency is ILS or account_type is not creditcard - use event_date
  if (transaction.currency === 'ILS') {
    return dateToTimelessDateString(transaction.event_date);
  }
  return null;
}
