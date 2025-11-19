import { type ReactElement } from 'react';
import type { DepositTransactionRowType } from '../columns.js';

type Props = {
  transaction: DepositTransactionRowType;
};

export function Amount({ transaction }: Props): ReactElement {
  const amount = Number(transaction.amount.raw);
  const colorClass = amount < 0 ? 'text-green-700' : 'text-red-500';

  return (
    <div className={`flex flex-col justify-center font-mono ${colorClass}`}>
      {transaction.amount.formatted}
    </div>
  );
}
