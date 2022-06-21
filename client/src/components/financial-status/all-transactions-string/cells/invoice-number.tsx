import { CSSProperties } from 'react';

import { entitiesWithoutInvoiceNumuber, isBusiness } from '../../../../helpers';
import type { TransactionType } from '../../../../models/types';
import { UpdateButton } from '../../../common';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const InvoiceNumber = ({ transaction, style }: Props) => {
  const indicator =
    isBusiness(transaction) &&
    !entitiesWithoutInvoiceNumuber.includes(transaction.financial_entity ?? '') &&
    !transaction.tax_invoice_number;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {transaction.tax_invoice_number ?? 'null'}
      <UpdateButton transaction={transaction} propertyName="tax_invoice_number" promptText="New Invoice Number:" />
    </td>
  );
};
