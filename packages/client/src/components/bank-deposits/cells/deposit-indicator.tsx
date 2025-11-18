import { useMemo, type ReactElement } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Badge } from '../../ui/badge.js';
import type { DepositTransactionRowType } from '../columns.js';

type Props = {
  transaction: DepositTransactionRowType;
};

export function DepositIndicator({ transaction }: Props): ReactElement {
  const isDeposit = useMemo(() => Number(transaction.amount.raw) > 0, [transaction.amount.raw]);

  return (
    <div className="flex items-center gap-2">
      {isDeposit ? (
        <>
          <ArrowDown className="h-4 w-4 text-green-600" />
          <Badge variant="outline" className="bg-green-50 text-green-700">
            Deposit
          </Badge>
        </>
      ) : (
        <>
          <ArrowUp className="h-4 w-4 text-red-600" />
          <Badge variant="outline" className="bg-red-50 text-red-700">
            Withdrawal
          </Badge>
        </>
      )}
    </div>
  );
}
