import { type ReactElement } from 'react';
import { format } from 'date-fns';
import type { DepositTransactionRowType } from '../columns.js';

type Props = {
  transaction: DepositTransactionRowType;
};

export function DateCell({ transaction }: Props): ReactElement {
  return (
    <div className="flex flex-col justify-center">
      {transaction.eventDate ? format(new Date(transaction.eventDate), 'dd/MM/yyyy') : '-'}
    </div>
  );
}
