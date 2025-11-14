import { Injector } from 'graphql-modules';
import { getDocumentsMinDate } from '@modules/documents/helpers/dates.helper.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import {
  getTransactionsMinDebitDate,
  getTransactionsMinEventDate,
} from '@modules/transactions/helpers/debit-date.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { dateToTimelessDateString } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import { LedgerProvider } from '../providers/ledger.provider.js';
import { getLedgerMinDebitDate, getLedgerMinInvoiceDate } from './dates.helper.js';

export function getMinDate(dates: (Date | null | undefined)[]): Date | null {
  const filteredDates = dates.filter(Boolean) as Date[];

  if (filteredDates.length === 0) {
    return null;
  }

  return filteredDates.sort((dateA, dateB) => dateA.getTime() - dateB.getTime())[0];
}

export async function isChargeLocked(
  chargeId: string,
  injector: Injector,
  lockDate?: TimelessDateString,
): Promise<boolean> {
  if (!lockDate) {
    return false;
  }

  const [ledgerRecords, transactions, documents] = await Promise.all([
    injector.get(LedgerProvider).getLedgerRecordsByChargesIdLoader.load(chargeId),
    injector.get(TransactionsProvider).transactionsByChargeIDLoader.load(chargeId),
    injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(chargeId),
  ]);

  const chargeMinDate = getMinDate([
    getLedgerMinDebitDate(ledgerRecords),
    getLedgerMinInvoiceDate(ledgerRecords),
    getTransactionsMinDebitDate(transactions),
    getTransactionsMinEventDate(transactions),
    getDocumentsMinDate(documents),
  ]);

  if (!chargeMinDate) {
    return false;
  }

  if (
    dateToTimelessDateString(chargeMinDate) &&
    lockDate >= dateToTimelessDateString(chargeMinDate)
  ) {
    return true;
  }

  return false;
}
