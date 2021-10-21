import * as React from 'react';
import { UpdateButton } from '../components/updateButton';
import { AllTransactionsEntity } from '../getAllTransactions';
import { isBusiness } from '../utils';

type Props = {
  transaction: AllTransactionsEntity;
};

export const InvoiceImg: React.FC<Props> = ({ transaction }) => {
  const indicator =
    isBusiness(transaction) && !transaction.proforma_invoice_file;

  return (
    <div
      style={indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : undefined}
    >
      {transaction.proforma_invoice_file && (
        <a href={transaction.proforma_invoice_file} target="_blank">
          yes
        </a>
      )}
      <UpdateButton
        transaction={transaction}
        propertyName={'proforma_invoice_file'}
        promptText="New Invoice Photo:"
      />
    </div>
  );
};
