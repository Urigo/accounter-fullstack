import type { ReactElement } from 'react';
import { format } from 'date-fns';
import type { TransactionsTableRowType } from '../columns.js';

type Props = {
  transaction: TransactionsTableRowType;
};

export const DebitDate = ({ transaction }: Props): ReactElement => {
  const effectiveDate = 'effectiveDate' in transaction ? transaction.effectiveDate : undefined;

  return (
    <div className="flex flex-col justify-center">
      <div>{effectiveDate && format(new Date(effectiveDate), 'dd/MM/yy')}</div>
      {transaction.sourceEffectiveDate && (
        <div className="text-xs text-gray-500">
          (Originally {format(new Date(transaction.sourceEffectiveDate), 'dd/MM/yy')})
        </div>
      )}
    </div>
  );
};
