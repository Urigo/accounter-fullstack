import { type ReactElement } from 'react';
import { cn } from '@/lib/utils.js';
import { type Currency } from '../../../gql/graphql.js';
import type { ExtendedLedger } from '../business-extended-info.js';

type Props = {
  row: ExtendedLedger;
  currency: Currency;
};

export const CurrencyAmountCell = ({ row, currency }: Props): ReactElement => {
  const foreignAmount =
    row.foreignAmount && row.foreignAmount.currency === currency ? row.foreignAmount : null;

  if (!foreignAmount || foreignAmount.raw === 0) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  return (
    <span
      className={cn(
        'text-sm font-medium whitespace-nowrap',
        foreignAmount.raw > 0 ? 'text-green-700' : 'text-red-600',
      )}
    >
      {foreignAmount.formatted}
    </span>
  );
};
