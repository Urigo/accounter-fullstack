import React from 'react';
import { format } from 'date-fns';
import { DateCellProps } from './types';

export const DateCell: React.FC<DateCellProps> = ({ date, diff }) => {
  const formattedDate = date ? format(new Date(date), 'dd/MM/yy') : undefined;
  const diffFormattedDate = diff ? format(new Date(diff), 'dd/MM/yy') : undefined;
  const isDiff = diffFormattedDate && formattedDate !== diffFormattedDate;

  return (
    <div className="flex flex-col">
      <p className={isDiff ? 'line-through' : ''}>{formattedDate ?? 'Missing Data'}</p>
      {isDiff && (
        <div className="border-2 border-yellow-500 rounded-md px-1">{diffFormattedDate}</div>
      )}
    </div>
  );
};
