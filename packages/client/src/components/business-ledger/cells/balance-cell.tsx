import { type ReactElement } from 'react';
import { cn } from '@/lib/utils.js';
import { type Currency } from '../../../gql/graphql.js';
import { formatAmountWithCurrency } from '../../../helpers/index.js';

type Props = {
  balance: number;
  currency: Currency;
};

export const BalanceCell = ({ balance, currency }: Props): ReactElement => {
  const formattedBalance = formatAmountWithCurrency(balance, currency);

  return (
    <span
      className={cn(
        'text-sm font-medium whitespace-nowrap',
        balance === 0 ? 'text-gray-600' : balance > 0 ? 'text-green-700' : 'text-red-600',
      )}
    >
      {formattedBalance}
    </span>
  );
};
