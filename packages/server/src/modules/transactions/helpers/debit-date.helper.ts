import { Injector } from 'graphql-modules';
import { LedgerError } from '@modules/ledger/helpers/utils.helper.js';
import { Currency } from '@shared/gql-types';
import type { IGetTransactionsByIdsResult } from '../__generated__/transactions-new.types.js';
import { TransactionsSourceProvider } from '../providers/transactions-source.provider.js';

export async function getTransactionDebitDate(
  transaction: IGetTransactionsByIdsResult,
  injector: Injector,
) {
  try {
    const transactionSource = await injector
      .get(TransactionsSourceProvider)
      .transactionSourceByIdLoader.load(transaction.id);
    return transactionSource.debit_timestamp || transaction.debit_date || transaction.event_date;
  } catch (error) {
    console.error(`Error fetching transaction source for ID ${transaction.id}:`, error);
    return transaction.debit_date || transaction.event_date;
  }
}

export async function getValueDate(transaction: IGetTransactionsByIdsResult, injector: Injector) {
  const transactionSource = await injector
    .get(TransactionsSourceProvider)
    .transactionSourceByIdLoader.load(transaction.id);
  if (transactionSource.debit_timestamp) return transactionSource.debit_timestamp;
  if (transaction.debit_date) {
    return transaction.debit_date;
  }
  if (
    transaction.currency === Currency.Ils &&
    ['ISRACARD', 'AMEX'].includes(transactionSource.source_origin ?? '')
  ) {
    // if currency is ILS or account_type is not creditcard - use event_date
    return transaction.event_date;
  }
  throw new LedgerError(
    `Transaction reference "${transactionSource.source_reference}" is missing debit date`,
  );
}
