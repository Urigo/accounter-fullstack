import * as React from 'react';
import { UpdateButton } from '../components/updateButton';
import { AllTransactionsEntity } from '../getAllTransactions';

type Props = {
  transaction: AllTransactionsEntity;
  style: React.CSSProperties;
};

export const ReceiptFile: React.FC<Props> = ({ transaction, style }) => {
  const clipboardUpdate = () => {
    navigator.clipboard.writeText(transaction.links).then(
      function () {
        console.log('clipboard successfully set');
      },
      function () {
        console.log('clipboard failed');
      }
    );
  };

  return (
    <td style={{...style}}>
      {transaction.links && 'yes'}
      <UpdateButton
        transaction={transaction}
        propertyName={'links'}
        promptText="New links:"
      />
      <button type="button" onClick={clipboardUpdate}>
        &#9986;
      </button>
    </td>
  );
};
