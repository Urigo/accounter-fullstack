import { type ReactElement } from 'react';
import { format } from 'date-fns';

type Props = {
  date?: Date;
};

export const DateCell = ({ date }: Props): ReactElement => {
  return <div>{date && format(date, 'dd/MM/yy')}</div>;
};
