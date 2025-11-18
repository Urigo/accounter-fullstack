import type { Injector } from 'graphql-modules';
import { getChargeTransactionsMeta } from '@modules/charges/helpers/common.helper.js';
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

  const [{ transactionsMinDebitDate, transactionsMinEventDate }] = await Promise.all([
    getChargeTransactionsMeta(charge.id, injector),
  ]);

  const chargeMinDate = getMinDate([
    charge.ledger_min_invoice_date,
    charge.ledger_min_value_date,
    transactionsMinDebitDate,
    transactionsMinEventDate,
    charge.documents_min_date,
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
