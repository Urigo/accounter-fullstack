import type { ReactElement } from 'react';
import type { TimelessDateString } from '@/helpers/index.js';

type Props = {
  date?: TimelessDateString;
};

export const DateCell = ({ date }: Props): ReactElement => {
  return <p className="text-sm font-medium">{date ?? ''}</p>;
};
