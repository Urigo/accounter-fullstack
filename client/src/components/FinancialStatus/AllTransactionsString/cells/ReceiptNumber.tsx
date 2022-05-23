import { CSSProperties } from 'react';
import type { TransactionType } from '../../../../models/types';
import { UpdateButton } from '../../../common';
import { entitiesWithoutInvoiceNumuber, isBusiness } from '../../../../helpers';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const ReceiptNumber = ({ transaction, style }: Props) => {
  const indicator =
    isBusiness(transaction) &&
    !entitiesWithoutInvoiceNumuber.includes(transaction.financial_entity ?? '') &&
    !transaction.receipt_number &&
    !transaction.tax_invoice_number;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {transaction.receipt_number ?? 'null'}
      <UpdateButton transaction={transaction} propertyName="receipt_number" promptText="New Receipt Number:" />
    </td>
  );
};
