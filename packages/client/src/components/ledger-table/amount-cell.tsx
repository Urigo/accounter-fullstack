import type { ReactElement } from 'react';
import { Currency } from '../../gql/graphql.js';

type AmountData = {
  foreignAmount?: {
    formatted: string;
    currency: string;
  } | null;
  localAmount?: {
    formatted: string;
  } | null;
};

type Props = AmountData & {
  diff?: AmountData;
};

export const AmountCell = ({ foreignAmount, localAmount, diff }: Props): ReactElement => {
  const isForeign = foreignAmount != null && foreignAmount.currency !== Currency.Ils;

  const isLocalAmountDiff = diff && diff.localAmount?.formatted !== localAmount?.formatted;
  const isForeignAmountDiff = diff && diff.foreignAmount?.formatted !== foreignAmount?.formatted;

  return (
    <div className="flex flex-col">
      {(localAmount || isLocalAmountDiff) && (
        <>
          <div className="flex gap-2  items-center">
            {isForeign && (
              <p className={isForeignAmountDiff ? 'line-through' : ''}>{foreignAmount.formatted}</p>
            )}
            {isForeignAmountDiff && diff.foreignAmount && (
              <p className="border-2 border-yellow-500 rounded-md">
                {diff.foreignAmount.formatted}
              </p>
            )}
          </div>

          <div className="flex gap-2  items-center">
            {localAmount != null && (
              <p className={isLocalAmountDiff ? 'line-through' : ''}>{localAmount.formatted}</p>
            )}
            {isLocalAmountDiff && diff.localAmount && (
              <p className="border-2 border-yellow-500 rounded-md">{diff.localAmount.formatted}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
