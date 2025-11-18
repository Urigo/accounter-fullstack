import { useMemo, type ReactElement } from 'react';
import { BanknoteArrowDown, BanknoteArrowUp } from 'lucide-react';
import { Badge } from '../../ui/badge.js';
import type { DepositTransactionRowType } from '../columns.js';

type Props = {
  transaction: DepositTransactionRowType;
};

export function DepositIndicator({ transaction }: Props): ReactElement {
  const { isInterest, amount } = transaction;
  const isDeposit = useMemo(() => Number(amount.raw) < 0, [amount.raw]);

  return (
    <div className="flex items-center gap-2">
      {isInterest ? (
        <>
          <BanknoteArrowDown className="size-4 text-red-600" />
          <Badge variant="outline" className="bg-red-50 text-red-700">
            Interest
          </Badge>
        </>
      ) : isDeposit ? (
        <>
          <BanknoteArrowUp className="size-4 text-green-600" />
          <Badge variant="outline" className="bg-green-50 text-green-700">
            Deposit
          </Badge>
        </>
      ) : (
        <>
          <BanknoteArrowDown className="size-4 text-red-600" />
          <Badge variant="outline" className="bg-red-50 text-red-700">
            Withdrawal
          </Badge>
        </>
      )}
    </div>
  );
}
