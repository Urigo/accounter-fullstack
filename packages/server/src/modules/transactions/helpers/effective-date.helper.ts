import type { IGetTransactionsByIdsResult } from '@modules/transactions/types.js';
import { Currency } from '@shared/gql-types';
import { dateToTimelessDateString } from '@shared/helpers';

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
  // if currency is ILS or account_type is not creditcard - use event_date
  if (
    transaction.currency === Currency.Ils &&
    ['ISRACARD', 'AMEX'].includes(transaction.source_origin ?? '')
  ) {
    return dateToTimelessDateString(transaction.event_date);
  }
  return null;
}
