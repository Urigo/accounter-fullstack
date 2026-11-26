import type { Page } from 'puppeteer';
import { callBroker, validate } from './broker.js';
import { ilsTransactionsResponseSchema } from './schemas.js';

/** `TrxType` values of the site's own filter. */
export const ILS_TRANSACTION_FILTER = {
  all: '1',
  /** Cheques ("ריכוז שיקים"). */
  checks: '2',
  /** Returned cheques. */
  returnedChecks: '8',
} as const;

export type IlsTransactionsRange = {
  fromDate: Date;
  toDate: Date;
  filter?: keyof typeof ILS_TRANSACTION_FILTER;
};

/**
 * Shekel checking-account transactions between two dates, with the balance.
 *
 * `HistoryTransactionsItems` are booked transactions, newest first;
 * `TodayTransactionsItems` are today's, not yet booked. The bank keeps about three years.
 * `FITID` is not unique on its own: one bank reference can carry several rows, told apart
 * by `TrxIndex`.
 */
export async function getIlsTransactions(
  page: Page,
  sessionId: string,
  accountIndex: number,
  range: IlsTransactionsRange,
  validateSchema: boolean,
) {
  const raw = await callBroker(page, sessionId, {
    module: 'UC_SO_27_GetBusinessAccountTrx',
    state: 'BusinessAccountTrx',
    params: {
      RequestType: '',
      // The site sends `Date.toUTCString()`; "3" is its "between dates" period.
      FromDateUTC: range.fromDate.toUTCString(),
      ToDateUTC: range.toDate.toUTCString(),
      PeriodType: '3',
      OperationsNumber: '40',
      Amount: 0,
      AmountType1: 0,
      AmountType2: 0,
      TrxType: ILS_TRANSACTION_FILTER[range.filter ?? 'all'],
      ReferenceNumber: '0',
      BeneficiaryName: '0',
      BeneficiaryBankCode: '0',
      BeneficiaryBranch: '0',
      BeneficiaryAccountNumber: '0',
      InvoiceNumber: '0',
      AccountIndex: accountIndex,
    },
  });
  return validate(ilsTransactionsResponseSchema, raw, validateSchema);
}
