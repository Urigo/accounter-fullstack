import { type ReactElement } from 'react';
import { cn } from '@/lib/utils.js';
import { type Currency } from '../../../gql/graphql.js';
import { formatAmountWithCurrency } from '../../../helpers/index.js';
import type { ExtendedLedger } from '../business-extended-info.js';

type Props = {
  row: ExtendedLedger;
  currency: Currency;
};

export const CurrencyBalanceCell = ({ row, currency }: Props): ReactElement => {
  const key = `${currency.toLowerCase()}Balance`;
  const balance = (row[key] as number) ?? 0;

  if (balance === 0) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  const formattedBalance = formatAmountWithCurrency(balance, currency);

  return (
    <span
      className={cn(
        'text-sm font-medium whitespace-nowrap',
        balance > 0 ? 'text-green-700' : 'text-red-600',
      )}
    >
      {formattedBalance}
    </span>
  );
};
