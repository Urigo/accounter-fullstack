import { CSSProperties } from 'react';
import { format } from 'date-fns';
import type { TransactionType } from '../../../../models/types';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const Date = ({ transaction, style }: Props) => {
  return (
    <td style={{ ...style }}>
      {format(transaction.event_date, 'dd/MM/yy')}
      {transaction.debit_date && (
        <div style={{ fontSize: '12px', color: 'gray' }}>
          {format(transaction.debit_date, 'dd/MM/yy')}
        </div>
      )}
    </td>
  );
};
