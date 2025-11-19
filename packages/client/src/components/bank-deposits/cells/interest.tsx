import { useMemo, type ReactElement } from 'react';
import type { DepositTransactionRowType } from '../columns.js';

type Props = {
  transaction: DepositTransactionRowType;
};

export function Interest({ transaction }: Props): ReactElement {
  const formattedBalance = useMemo(() => {
    const { currency } = transaction.amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(transaction.totalInterest);
  }, [transaction.totalInterest, transaction.amount]);

  return (
    <div className="flex flex-col justify-center font-mono font-semibold">{formattedBalance}</div>
  );
}
