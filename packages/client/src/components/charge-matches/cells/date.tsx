import type { ReactElement } from 'react';
import { formatTimelessDateString } from '@/helpers/index.js';

type Props = {
  date?: Date;
};

export const DateCell = ({ date }: Props): ReactElement => {
  return <p className="text-sm font-medium">{date ? formatTimelessDateString(date) : ''}</p>;
};
