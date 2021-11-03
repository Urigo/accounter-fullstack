import * as React from 'react';
import { AllTransactionsEntity } from '../getAllTransactions';

type Props = {
  transaction: AllTransactionsEntity;
};

export const Account: React.FC<Props> = ({ transaction }) => {
  return (
    <td>
      {transaction.account_number}
      {transaction.account_type}
    </td>
  );
};
