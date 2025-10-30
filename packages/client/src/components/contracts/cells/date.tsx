import type { ReactElement } from 'react';
import type { TimelessDateString } from '@/helpers/index.js';

type Props = {
  timelessDate: TimelessDateString;
};

export const DateCell = ({ timelessDate }: Props): ReactElement => {
  return (
    <p className="text-sm font-medium">
      {new Date(timelessDate).toLocaleDateString(undefined, { timeZone: 'UTC' })}
    </p>
  );
};
