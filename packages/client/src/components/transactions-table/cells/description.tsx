import { ReactElement } from 'react';
import { TransactionsTableRowType } from '../columns.js';

type Props = {
  transaction: TransactionsTableRowType;
};

export const Description = ({ transaction }: Props): ReactElement => {
  const cellText = 'sourceDescription' in transaction ? transaction.sourceDescription : 'Missing';

  return (
    <div className="flex flex-wrap">
      <div className="flex flex-col justify-center">{cellText}</div>
    </div>
  );
};
