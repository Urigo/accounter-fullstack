import type { IGetTransactionsByIdsResult } from '../../../modules/transactions/types.js';
import { Currency } from '../../../shared/enums.js';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';

export function effectiveDateSupplement(transaction: IGetTransactionsByIdsResult) {
  if (transaction.debit_date_override) {
    return dateToTimelessDateString(transaction.debit_date_override);
  }
  if (transaction.debit_timestamp) {
    return dateToTimelessDateString(transaction.debit_timestamp);
  }
  if (transaction.debit_date) {
    return dateToTimelessDateString(transaction.debit_date);
  }
  // if currency is ILS, fallback to event_date
  if (transaction.currency === Currency.Ils) {
    return dateToTimelessDateString(transaction.event_date);
  }
  return null;
}
