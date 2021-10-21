import moment from 'moment';
import * as React from 'react';
import { AllTransactionsEntity } from '../getAllTransactions';

type Props = {
  transaction: AllTransactionsEntity;
};

export const Date: React.FC<Props> = ({ transaction }) => {
  return (
    <div>
      {moment(transaction.event_date).format('DD/MM/YY')}
      {transaction.debit_date && (
        <div style={{ fontSize: '12px', color: 'gray' }}>
          {moment(transaction.debit_date).format('DD/MM/YY')}
        </div>
      )}
    </div>
  );
};
