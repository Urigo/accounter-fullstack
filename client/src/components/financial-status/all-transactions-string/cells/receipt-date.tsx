import moment from 'moment';
import { CSSProperties } from 'react';
import type { TransactionType } from '../../../../models/types';
import { UpdateButton } from '../../../common';
import { isBusiness } from '../../../../helpers';

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
      {transaction.receipt_date && moment(transaction.receipt_date).format('DD/MM/YY')}
      <UpdateButton transaction={transaction} propertyName="receipt_date" promptText="New Receipt Date:" />
    </td>
  );
};
