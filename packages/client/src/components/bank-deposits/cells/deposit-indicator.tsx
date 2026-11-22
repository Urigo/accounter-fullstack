import { useMemo, type ReactElement } from 'react';
import { BanknoteArrowDown, BanknoteArrowUp, Sigma } from 'lucide-react';
import { Badge } from '../../ui/badge.js';
import type { DepositTransactionRowType } from '../columns.js';

type Props = {
  transaction: DepositTransactionRowType;
};

const SOURCE_LABEL: Record<string, string> = {
  BANK: 'bank',
  BANK_ALLOCATED: 'bank, allocated',
  INFERRED: 'inferred',
};

const REALIZED_LABEL = {
  capitalizedInterest: 'Capitalized interest',
  tax: 'Tax withheld',
  revaluation: 'Revaluation',
} as const;

export function DepositIndicator({ transaction }: Props): ReactElement {
  const { isInterest, amount, kind, source } = transaction;
  const isDeposit = useMemo(() => Number(amount.raw) < 0, [amount.raw]);

  if (kind !== 'transaction') {
    return (
      <div className="flex items-center gap-2">
        <Sigma className="size-4 text-blue-600" />
        <Badge variant="outline" className="bg-blue-50 text-blue-700">
          {REALIZED_LABEL[kind]}
        </Badge>
        {source && (
          <span className="text-xs text-muted-foreground">({SOURCE_LABEL[source] ?? source})</span>
        )}
      </div>
    );
  }

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
