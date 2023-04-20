import { format } from 'date-fns';
import type { TimelessDateString } from '@shared/types';
import type { IGetTransactionsByIdsResult } from '../types.js';

export function effectiveDateSupplement(transaction: IGetTransactionsByIdsResult) {
  // if debit_date exists - use it
  if (transaction.debit_date) {
    return format(transaction.debit_date, 'yyyy-MM-dd') as TimelessDateString;
  }
  // if currency is ILS or account_type is not creditcard - use event_date
  // TODO(Gil): was also filtering according to creditcard (transaction.account_type != 'creditcard' || )
  if (transaction.currency == 'ILS') {
    return format(transaction.event_date, 'yyyy-MM-dd') as TimelessDateString;
  }
  return null;
}
