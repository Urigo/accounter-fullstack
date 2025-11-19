import { type ReactElement } from 'react';
import { format } from 'date-fns';

type Props = {
  date?: string;
};

export const DateCell = ({ date }: Props): ReactElement => {
  if (!date) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  return (
    <span className="text-sm font-medium whitespace-nowrap">
      {format(new Date(date), 'dd/MM/yy')}
    </span>
  );
};
