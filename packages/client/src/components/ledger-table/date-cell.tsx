import type { ReactElement } from 'react';
import { formatTimelessDate, type TimelessDateString } from '@/helpers/index.js';

type Props = {
  date?: TimelessDateString | null;
  diff?: TimelessDateString | null;
};

export const DateCell = ({ date, diff }: Props): ReactElement => {
  const formattedDate = date ? formatTimelessDate(date) : undefined;

  // calculate diff date
  const diffFormattedDate = diff ? formatTimelessDate(diff) : undefined;
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
