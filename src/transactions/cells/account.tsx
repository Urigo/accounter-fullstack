import * as React from 'react';
import { AllTransactionsEntity } from '../getAllTransactions';

type Props = {
  transaction: AllTransactionsEntity;
  style: React.CSSProperties;
};

export const Account: React.FC<Props> = ({ transaction, style }) => {
  return (
    <td style={{...style}}>
      {transaction.account_number}
      {transaction.account_type}
    </td>
  );
};
