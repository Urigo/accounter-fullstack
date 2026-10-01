import { Currency } from '../../../shared/enums.js';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import type { IGetTransactionsByIdsResult } from '../types.js';

export function effectiveDateSupplement(
  transaction: IGetTransactionsByIdsResult,
): TimelessDateString | null {
  if (transaction.debit_date_override) {
    return transaction.debit_date_override;
  }
  if (transaction.debit_timestamp) {
    return dateToTimelessDateString(transaction.debit_timestamp);
  }
  if (transaction.debit_date) {
    return transaction.debit_date;
  }
  // if currency is ILS, fallback to event_date
  if (transaction.currency === Currency.Ils) {
    return transaction.event_date;
  }
  return null;
}
