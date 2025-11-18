import { useMemo, type ReactElement } from 'react';
import type { DepositTransactionRowType } from '../columns.js';

type Props = {
  transaction: DepositTransactionRowType;
};

export function CumulativeBalance({ transaction }: Props): ReactElement {
  const formattedBalance = useMemo(() => {
    const currency = transaction.amount.currency || 'USD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(transaction.cumulativeBalance);
  }, [transaction.cumulativeBalance, transaction.amount.currency]);

  return (
    <div className="flex flex-col justify-center font-mono font-semibold">{formattedBalance}</div>
  );
}
