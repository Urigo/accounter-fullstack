import React from 'react';
import { CounterpartyCellProps } from './types';

interface CounterpartyCellComponentProps extends CounterpartyCellProps {
  onAccountClick?: (accountId: string, accountName: string) => void;
}

export const CounterpartyCell: React.FC<CounterpartyCellComponentProps> = ({
  account,
  diffAccount,
  onAccountClick,
}) => {
  const isAccountDiff = diffAccount && diffAccount?.id !== account?.id;

  const handleAccountClick = (acc: { id: string; name: string }) => {
    if (onAccountClick) {
      onAccountClick(acc.id, acc.name);
    }
  };

  return (
    <div className="flex flex-col whitespace-normal">
      {(account || isAccountDiff) && (
        <>
          {account && (
            <button
              onClick={() => handleAccountClick(account)}
              className={`text-left text-blue-600 hover:text-blue-800 hover:underline font-semibold ${
                isAccountDiff ? 'line-through' : ''
              }`}
            >
              {account.name}
            </button>
          )}
          {isAccountDiff && diffAccount && (
            <div className="border-2 border-yellow-500 rounded-md p-1 mt-1">
              <button
                onClick={() => handleAccountClick(diffAccount)}
                className="text-left text-blue-600 hover:text-blue-800 hover:underline font-semibold"
              >
                {diffAccount.name}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
