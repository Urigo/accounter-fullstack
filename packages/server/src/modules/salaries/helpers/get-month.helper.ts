import type { IGetChargesByIdsResult } from '@modules/charges/types';
import { getMonthFromDescription } from '@shared/helpers';

export function getSalaryMonth(charge: IGetChargesByIdsResult): string | null {
  if (charge.user_description?.length) {
    const transactionDate =
      charge.transactions_min_debit_date ?? charge.transactions_min_event_date ?? undefined;
    const months = getMonthFromDescription(charge.user_description, transactionDate);

    if (months?.length) {
      return months[0];
    }
  }
  const date = charge.transactions_min_debit_date ?? charge.transactions_min_event_date;
  if (date) {
    const day = date.getDate();
    if (day > 25) {
      const month = date.toISOString().slice(0, 7);
      return month;
    }
    if (day < 15) {
      const adjustedDate = new Date(date);
      adjustedDate.setMonth(date.getMonth() - 1);
      const month = adjustedDate.toISOString().slice(0, 7);
      return month;
    }
  }
  return null;
}
