import { type ReactElement } from 'react';
import { format } from 'date-fns';
import { timelessDateStringToLocalDate, type TimelessDateString } from '@/helpers/index.js';

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
    date: displayDate ? timelessDateStringToLocalDate(displayDate) : undefined,
    mostMinDate: mostMinDate ? timelessDateStringToLocalDate(mostMinDate) : undefined,
    mostMaxDate: mostMaxDate ? timelessDateStringToLocalDate(mostMaxDate) : undefined,
  };
}

export type DateProps = {
  date?: Date;
  mostMinDate?: Date;
  mostMaxDate?: Date;
};

export const DateCell = ({ date, mostMinDate, mostMaxDate }: DateProps): ReactElement => {
  return (
    <>
      <div>{date && format(date, 'dd/MM/yy')}</div>
      {mostMinDate && mostMaxDate && mostMinDate.getTime() !== mostMaxDate.getTime() ? (
        <div className="text-xs text-gray-500">
          ({format(mostMinDate, 'dd/MM/yy')} - {format(mostMaxDate, 'dd/MM/yy')})
        </div>
      ) : null}
    </>
  );
};
