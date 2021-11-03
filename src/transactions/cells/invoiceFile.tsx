import * as React from 'react';
import { UpdateButton } from '../components/updateButton';
import { AllTransactionsEntity } from '../getAllTransactions';
import { isBusiness } from '../utils';

type Props = {
  transaction: AllTransactionsEntity;
};

export const InvoiceFile: React.FC<Props> = ({ transaction }) => {
  const indicator = isBusiness(transaction) && !transaction.tax_invoice_file;

  return (
    <td
      style={indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : undefined}
    >
      {transaction.tax_invoice_file && (
        <a href={transaction.tax_invoice_file} target="_blank">
          yes
        </a>
      )}
      <UpdateButton
        transaction={transaction}
        propertyName={'tax_invoice_file'}
        promptText="New Invoice path:"
      />
    </td>
  );
};
