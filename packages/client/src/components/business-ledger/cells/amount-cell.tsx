import { type ReactElement } from 'react';
import { cn } from '@/lib/utils.js';

type Props = {
  amount?: {
    formatted: string;
    raw: number;
  };
};

export const AmountCell = ({ amount }: Props): ReactElement => {
  if (!amount || amount.raw === 0) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  return (
    <span
      className={cn(
        'text-sm font-medium whitespace-nowrap',
        amount.raw > 0 ? 'text-green-700' : 'text-red-600',
      )}
    >
      {amount.formatted}
    </span>
  );
};
