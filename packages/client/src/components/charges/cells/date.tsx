import { type ReactElement } from 'react';
import { format } from 'date-fns';

export function getDateProps({
  minDebitDate,
  minEventDate,
  minDocumentsDate,
  maxDebitDate,
  maxEventDate,
  maxDocumentsDate,
}: {
  minDebitDate: Date | null;
  minEventDate: Date | null;
  minDocumentsDate: Date | null;
  maxDebitDate: Date | null;
  maxEventDate: Date | null;
  maxDocumentsDate: Date | null;
}): DateProps | undefined {
  if (!minDocumentsDate && !minEventDate && !minDebitDate) {
    return undefined;
  }
  const minTimestamps = [minDocumentsDate, minEventDate, minDebitDate]
    .filter(Boolean)
    .map(d => new Date(d!).getTime());
  const maxTimestamps = [maxDocumentsDate, maxEventDate, maxDebitDate]
    .filter(Boolean)
    .map(d => new Date(d!).getTime());
  const mostMinDate = minTimestamps.length > 0 ? new Date(Math.min(...minTimestamps)) : undefined;
  const mostMaxDate = maxTimestamps.length > 0 ? new Date(Math.max(...maxTimestamps)) : undefined;

  return {
    date: minDocumentsDate || minEventDate || minDebitDate || undefined,
    mostMinDate,
    mostMaxDate,
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
