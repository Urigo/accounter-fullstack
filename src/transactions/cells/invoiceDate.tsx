import moment from 'moment';
import * as React from 'react';
import { UpdateButton } from '../components/updateButton';
import { AllTransactionsEntity } from '../getAllTransactions';
import { isBusiness } from '../utils';

type Props = {
  transaction: AllTransactionsEntity;
  style: React.CSSProperties;
};

export const InvoiceDate: React.FC<Props> = ({ transaction, style }) => {
  const indicator = isBusiness(transaction) && !transaction.tax_invoice_date;

  return (
    <td
      style={{
        ...style,
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
      }}
    >
      {transaction.tax_invoice_date &&
        moment(transaction.tax_invoice_date).format('DD/MM/YY')}
      <UpdateButton
        transaction={transaction}
        propertyName={'tax_invoice_date'}
        promptText="New Invoice Date:"
      />
    </td>
  );
};
