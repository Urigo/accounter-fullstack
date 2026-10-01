import { type ReactElement } from 'react';
import { format } from 'date-fns';
import { timelessDateStringToLocalDate, type TimelessDateString } from '@/helpers/index.js';

type Props = {
  date?: TimelessDateString;
};

export const DateCell = ({ date }: Props): ReactElement => {
  if (!date) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  return (
    <span className="text-sm font-medium whitespace-nowrap">
      {format(timelessDateStringToLocalDate(date), 'dd/MM/yy')}
    </span>
  );
};
