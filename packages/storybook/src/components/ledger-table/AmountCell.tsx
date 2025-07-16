import React from 'react';
import { AmountCellProps, Currency } from './types';

export const AmountCell: React.FC<AmountCellProps> = ({ foreignAmount, localAmount, diff }) => {
  const isForeign = foreignAmount != null && foreignAmount.currency !== Currency.Ils;
  const isLocalAmountDiff = diff && diff.localAmount?.formatted !== localAmount?.formatted;
  const isForeignAmountDiff = diff && diff.foreignAmount?.formatted !== foreignAmount?.formatted;

  return (
    <div className="flex flex-col">
      {(localAmount || isLocalAmountDiff) && (
        <>
          <div className="flex gap-2 items-center">
            {isForeign && (
              <p className={isForeignAmountDiff ? 'line-through' : ''}>{foreignAmount.formatted}</p>
            )}
            {isForeignAmountDiff && diff.foreignAmount && (
              <p className="border-2 border-yellow-500 rounded-md px-1">
                {diff.foreignAmount.formatted}
              </p>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {localAmount != null && (
              <p className={isLocalAmountDiff ? 'line-through' : ''}>{localAmount.formatted}</p>
            )}
            {isLocalAmountDiff && diff.localAmount && (
              <p className="border-2 border-yellow-500 rounded-md px-1">
                {diff.localAmount.formatted}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
