import type { ReactElement } from 'react';

type Props = {
  date?: Date;
};

export const DateCell = ({ date }: Props): ReactElement => {
  return (
    <p className="text-sm font-medium">
      {date?.toLocaleDateString(undefined, { timeZone: 'UTC' })}
    </p>
  );
};
