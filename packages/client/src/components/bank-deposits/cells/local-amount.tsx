import { useMemo, type ReactElement } from 'react';
import type { DepositTransactionRowType } from '../columns.js';

type Props = {
  transaction: DepositTransactionRowType;
};

export function LocalAmount({ transaction }: Props): ReactElement {
  const formattedAmount = useMemo(() => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(transaction.localAmount);
  }, [transaction.localAmount]);

  return (
    <div className="flex flex-col justify-center font-mono text-muted-foreground">
      {formattedAmount}
    </div>
  );
}
