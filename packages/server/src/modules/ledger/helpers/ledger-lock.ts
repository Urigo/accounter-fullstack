import type { Injector } from 'graphql-modules';
import { minTimelessDate } from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import {
  getChargeDocumentsMeta,
  getChargeLedgerMeta,
  getChargeTransactionsMeta,
} from '../../charges/helpers/common.helper.js';
import type { IGetChargesByIdsResult } from '../../charges/types.js';

export function getMinDate(
  dates: (TimelessDateString | null | undefined)[],
): TimelessDateString | null {
  return minTimelessDate(...dates);
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
    getChargeTransactionsMeta(charge, injector),
    getChargeLedgerMeta(charge, injector),
    getChargeDocumentsMeta(charge, injector),
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

  return lockDate >= chargeMinDate;
}
