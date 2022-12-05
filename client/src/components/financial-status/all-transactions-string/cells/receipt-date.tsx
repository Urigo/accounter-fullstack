import { CSSProperties } from 'react';
import { format } from 'date-fns';
import { isBusiness } from '../../../../helpers';
import type { TransactionType } from '../../../../models/types';
import { UpdateButton } from '../../../common';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const ReceiptDate = ({ transaction, style }: Props) => {
  const indicator = isBusiness(transaction) && !transaction.receipt_date;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {transaction.receipt_date && format(new Date(transaction.receipt_date), 'dd/MM/yy')}
      <UpdateButton
        transaction={transaction}
        propertyName="receipt_date"
        promptText="New Receipt Date:"
      />
    </td>
  );
};
