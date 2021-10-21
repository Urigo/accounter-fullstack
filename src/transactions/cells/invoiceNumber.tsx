import * as React from 'react';
import { UpdateButton } from '../components/updateButton';
import { AllTransactionsEntity } from '../getAllTransactions';
import { entitiesWithoutInvoiceNumuber, isBusiness } from '../utils';

type Props = {
  transaction: AllTransactionsEntity;
};

export const InvoiceNumber: React.FC<Props> = ({ transaction }) => {
  const indicator =
    isBusiness(transaction) &&
    !entitiesWithoutInvoiceNumuber.includes(
      transaction.financial_entity || ''
    ) &&
    !transaction.tax_invoice_number;

  return (
    <div
      style={indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : undefined}
    >
      {transaction.tax_invoice_number}
      <UpdateButton
        transaction={transaction}
        propertyName={'tax_invoice_number'}
        promptText="New Invoice Number:"
      />
    </div>
  );
};
