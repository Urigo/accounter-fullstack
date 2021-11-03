import moment from 'moment';
import * as React from 'react';
import { UpdateButton } from '../components/updateButton';
import { AllTransactionsEntity } from '../getAllTransactions';
import { isBusiness } from '../utils';

type Props = {
  transaction: AllTransactionsEntity;
};

export const InvoiceDate: React.FC<Props> = ({ transaction }) => {
  const indicator = isBusiness(transaction) && !transaction.tax_invoice_date;

  return (
    <td
      style={indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : undefined}
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
