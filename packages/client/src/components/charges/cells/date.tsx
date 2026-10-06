import { type ReactElement } from 'react';
import { formatTimelessDate, type TimelessDateString } from '@/helpers/index.js';

type ChargeDate = TimelessDateString | null | undefined;

export function getDateProps({
  minDebitDate,
  minEventDate,
  minDocumentsDate,
  maxDebitDate,
  maxEventDate,
  maxDocumentsDate,
}: {
  minDebitDate: ChargeDate;
  minEventDate: ChargeDate;
  minDocumentsDate: ChargeDate;
  maxDebitDate: ChargeDate;
  maxEventDate: ChargeDate;
  maxDocumentsDate: ChargeDate;
}): DateProps | undefined {
  if (!minDocumentsDate && !minEventDate && !minDebitDate) {
    return undefined;
  }
  const isDate = (date: ChargeDate): date is TimelessDateString => !!date;
  // `yyyy-mm-dd` strings sort chronologically
  const minDates = [minDocumentsDate, minEventDate, minDebitDate].filter(isDate).sort();
  const maxDates = [maxDocumentsDate, maxEventDate, maxDebitDate].filter(isDate).sort();
  const mostMinDate = minDates[0];
  const mostMaxDate = maxDates[maxDates.length - 1];

  const displayDate = minDocumentsDate || minEventDate || minDebitDate;

  return {
    date: displayDate ?? undefined,
    mostMinDate,
    mostMaxDate,
  };
}

export type DateProps = {
  date?: TimelessDateString;
  mostMinDate?: TimelessDateString;
  mostMaxDate?: TimelessDateString;
};

export const DateCell = ({ date, mostMinDate, mostMaxDate }: DateProps): ReactElement => {
  return (
    <>
      <div>{date && formatTimelessDate(date)}</div>
      {mostMinDate && mostMaxDate && mostMinDate !== mostMaxDate ? (
        <div className="text-xs text-gray-500">
          ({formatTimelessDate(mostMinDate)} - {formatTimelessDate(mostMaxDate)})
        </div>
      ) : null}
    </>
  );
};
