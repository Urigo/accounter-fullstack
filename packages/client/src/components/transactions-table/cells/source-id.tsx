import { ReactElement } from 'react';
import { TransactionsTableRowType } from '../columns.js';

type Props = {
  transaction: TransactionsTableRowType;
};

export const SourceID = ({ transaction }: Props): ReactElement => {
  return (
    <div className="flex flex-wrap">
      <div className="flex flex-col justify-center">{transaction.referenceKey}</div>
    </div>
  );
};
