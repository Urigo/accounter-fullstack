import { LedgerError } from '@modules/ledger/helpers/utils.helper.js';
import { Currency } from '@shared/gql-types';
import type { IGetTransactionsByIdsResult } from '../__generated__/transactions-new.types.js';

export function getTransactionDebitDate(transaction: IGetTransactionsByIdsResult) {
  return (
    transaction.debit_date_override ||
    transaction.debit_timestamp ||
    transaction.debit_date ||
    transaction.event_date
  );
}

export function getValueDate(transaction: IGetTransactionsByIdsResult) {
  if (transaction.debit_timestamp) return transaction.debit_timestamp;
  if (transaction.debit_date) {
    return transaction.debit_date;
  }
  if (
    transaction.currency === Currency.Ils &&
    ['ISRACARD', 'AMEX'].includes(transaction.source_origin ?? '')
  ) {
    // if currency is ILS or account_type is not creditcard - use event_date
    return transaction.event_date;
  }
  throw new LedgerError(
    `Transaction reference "${transaction.source_reference}" is missing debit date`,
  );
}
