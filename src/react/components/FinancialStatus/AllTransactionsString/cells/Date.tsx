import moment from 'moment';
import { CSSProperties, FC } from 'react';
import type { TransactionType } from '../../../../models/types';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const Date: FC<Props> = ({ transaction, style }) => {
  return (
    <td style={{ ...style }}>
      {moment(transaction.event_date).format('DD/MM/YY')}
      {transaction.debit_date && (
        <div style={{ fontSize: '12px', color: 'gray' }}>
          {moment(transaction.debit_date).format('DD/MM/YY')}
        </div>
      )}
    </td>
  );
};
