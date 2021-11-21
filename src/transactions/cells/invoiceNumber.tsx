import * as React from 'react';
import { UpdateButton } from '../components/updateButton';
import { AllTransactionsEntity } from '../getAllTransactions';
import { entitiesWithoutInvoiceNumuber, isBusiness } from '../utils';

type Props = {
  transaction: AllTransactionsEntity;
  style: React.CSSProperties;
};

export const InvoiceNumber: React.FC<Props> = ({ transaction, style }) => {
  const indicator =
    isBusiness(transaction) &&
    !entitiesWithoutInvoiceNumuber.includes(
      transaction.financial_entity || ''
    ) &&
    !transaction.tax_invoice_number;

  return (
    <td
      style={{
        ...style,
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
      }}
    >
      {transaction.tax_invoice_number ?? 'null'}
      <UpdateButton
        transaction={transaction}
        propertyName={'tax_invoice_number'}
        promptText="New Invoice Number:"
      />
    </td>
  );
};
