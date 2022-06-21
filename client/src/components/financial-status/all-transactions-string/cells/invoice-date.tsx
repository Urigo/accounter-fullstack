import moment from 'moment';
import { CSSProperties } from 'react';

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
      {transaction.tax_invoice_date && moment(transaction.tax_invoice_date).format('DD/MM/YY')}
      <UpdateButton transaction={transaction} propertyName="tax_invoice_date" promptText="New Invoice Date:" />
    </td>
  );
};
