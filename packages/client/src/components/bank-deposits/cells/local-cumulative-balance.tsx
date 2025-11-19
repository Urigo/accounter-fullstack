import { useMemo, type ReactElement } from 'react';
import type { DepositTransactionRowType } from '../columns.js';

type Props = {
  transaction: DepositTransactionRowType;
};

export function LocalCumulativeBalance({ transaction }: Props): ReactElement {
  const formattedBalance = useMemo(() => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: transaction.localCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(transaction.localCumulativeBalance);
  }, [transaction.localCumulativeBalance, transaction.localCurrency]);

  return (
    <div className="flex flex-col justify-center font-mono font-semibold text-muted-foreground">
      {formattedBalance}
    </div>
  );
}
