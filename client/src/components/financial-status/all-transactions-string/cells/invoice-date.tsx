import { CSSProperties } from 'react';
import { format } from 'date-fns';
import { isBusiness } from '../../../../helpers';
import type { TransactionType } from '../../../../models/types';
import { UpdateButton } from '../../../common';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const InvoiceDate = ({ transaction, style }: Props) => {
  const indicator = isBusiness(transaction) && !transaction.tax_invoice_date;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {transaction.tax_invoice_date && format(transaction.tax_invoice_date, 'dd/MM/yy')}
      <UpdateButton
        transaction={transaction}
        propertyName="tax_invoice_date"
        promptText="New Invoice Date:"
      />
    </td>
  );
};
