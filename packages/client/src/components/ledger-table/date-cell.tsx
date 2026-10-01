import type { ReactElement } from 'react';
import { format } from 'date-fns';
import { timelessDateStringToLocalDate, type TimelessDateString } from '@/helpers/index.js';

type Props = {
  date?: TimelessDateString | null;
  diff?: TimelessDateString | null;
};

export const DateCell = ({ date, diff }: Props): ReactElement => {
  const formattedDate = date ? format(timelessDateStringToLocalDate(date), 'dd/MM/yy') : undefined;

  // calculate diff date
  const diffFormattedDate = diff
    ? format(timelessDateStringToLocalDate(diff), 'dd/MM/yy')
    : undefined;
  const isDiff = diffFormattedDate && formattedDate !== diffFormattedDate;

  return (
    <>
      <p className={isDiff ? 'line-through' : ''}>{formattedDate ?? 'Missing Data'}</p>
      {isDiff && (
        <div className="flex flex-col border-2 border-yellow-500 rounded-md">
          {diffFormattedDate}
        </div>
      )}
    </>
  );
};
