import { CSSProperties } from 'react';
import type { TransactionType } from '../../../../models/types';
import { UpdateButton } from '../../../common';
import { isBusiness } from '../../../../helpers';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const InvoiceFile = ({ transaction, style }: Props) => {
  const indicator = isBusiness(transaction) && !transaction.tax_invoice_file;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {transaction.tax_invoice_file && (
        <a href={transaction.tax_invoice_file} target="_blank">
          yes
        </a>
      )}
      <UpdateButton transaction={transaction} propertyName="tax_invoice_file" promptText="New Invoice path:" />
    </td>
  );
};
