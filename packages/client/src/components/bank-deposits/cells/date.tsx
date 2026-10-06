import { type ReactElement } from 'react';
import { formatTimelessDate } from '../../../helpers/index.js';
import type { DepositTransactionRowType } from '../columns.js';

type Props = {
  transaction: DepositTransactionRowType;
};

export function DateCell({ transaction }: Props): ReactElement {
  return (
    <div className="flex flex-col justify-center">
      {transaction.eventDate ? formatTimelessDate(transaction.eventDate, 'dd/MM/yyyy') : '-'}
    </div>
  );
}
