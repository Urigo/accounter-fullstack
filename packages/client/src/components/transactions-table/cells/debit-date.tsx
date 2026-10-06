import type { ReactElement } from 'react';
import { formatTimelessDate } from '../../../helpers/index.js';
import type { TransactionsTableRowType } from '../columns.js';

type Props = {
  transaction: TransactionsTableRowType;
};

export const DebitDate = ({ transaction }: Props): ReactElement => {
  const effectiveDate = 'effectiveDate' in transaction ? transaction.effectiveDate : undefined;

  return (
    <div className="flex flex-col justify-center">
      <div>{effectiveDate && formatTimelessDate(effectiveDate)}</div>
      {transaction.sourceEffectiveDate && (
        <div className="text-xs text-gray-500">
          (Originally {formatTimelessDate(transaction.sourceEffectiveDate)})
        </div>
      )}
    </div>
  );
};
