import { CSSProperties } from 'react';

import { isBusiness } from '../../../../helpers';
import type { TransactionType } from '../../../../models/types';
import { UpdateButton } from '../../../common';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const ReceiptImg = ({ transaction, style }: Props) => {
  const indicator = isBusiness(transaction) && !transaction.receipt_image && !transaction.proforma_invoice_file;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {transaction.receipt_image && (
        <a href={transaction.receipt_image} target="_blank" rel="noreferrer">
          yes
        </a>
      )}
      <UpdateButton transaction={transaction} propertyName="receipt_image" promptText="New Receipt Photo:" />
    </td>
  );
};
