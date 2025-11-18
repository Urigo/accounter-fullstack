import type { Injector } from 'graphql-modules';
import {
  getChargeDocumentsMeta,
  getChargeLedgerMeta,
  getChargeTransactionsMeta,
} from '@modules/charges/helpers/common.helper.js';
import type { IGetChargesByIdsResult } from '@modules/charges/types.js';
import { dateToTimelessDateString } from '@shared/helpers';
import type { TimelessDateString } from '@shared/types';

export function getMinDate(dates: (Date | null | undefined)[]): Date | null {
  const filteredDates = dates.filter(Boolean) as Date[];

  if (filteredDates.length === 0) {
    return null;
  }

  return filteredDates.sort((dateA, dateB) => dateA.getTime() - dateB.getTime())[0];
}

export async function isChargeLocked(
  charge: IGetChargesByIdsResult,
  injector: Injector,
  lockDate?: TimelessDateString,
): Promise<boolean> {
  if (!lockDate) {
    return false;
  }

  const [
    { transactionsMinDebitDate, transactionsMinEventDate },
    { ledgerMinInvoiceDate, ledgerMinValueDate },
    { documentsMinDate },
  ] = await Promise.all([
    getChargeTransactionsMeta(charge.id, injector),
    getChargeLedgerMeta(charge.id, injector),
    getChargeDocumentsMeta(charge.id, injector),
  ]);

  const chargeMinDate = getMinDate([
    ledgerMinInvoiceDate,
    ledgerMinValueDate,
    transactionsMinDebitDate,
    transactionsMinEventDate,
    documentsMinDate,
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
