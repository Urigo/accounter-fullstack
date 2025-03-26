import { IGetChargesByIdsResult } from '@modules/charges/types';
import { dateToTimelessDateString } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';

export function getMinDate(dates: (Date | null | undefined)[]): Date | null {
  const filteredDates = dates.filter(Boolean) as Date[];

  if (filteredDates.length === 0) {
    return null;
  }

  return filteredDates.sort((dateA, dateB) => dateA.getTime() - dateB.getTime())[0];
}

export function isChargeLocked(
  charge: IGetChargesByIdsResult,
  lockDate?: TimelessDateString,
): boolean {
  if (!lockDate) {
    return false;
  }

  const chargeMinDate = getMinDate([
    charge.ledger_min_invoice_date,
    charge.ledger_min_value_date,
    charge.transactions_min_debit_date,
    charge.transactions_min_event_date,
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
