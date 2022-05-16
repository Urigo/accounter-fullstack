import { CSSProperties, FC } from 'react';
import type { TransactionType } from '../../../../models/types';
import { UpdateButton } from '../../../common';
import { isBusiness } from '../../../../helpers';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const InvoiceImg: FC<Props> = ({ transaction, style }) => {
  const indicator =
    isBusiness(transaction) && !transaction.proforma_invoice_file;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {transaction.proforma_invoice_file && (
        <a href={transaction.proforma_invoice_file} target="_blank">
          yes
        </a>
      )}
      <UpdateButton
        transaction={transaction}
        propertyName="proforma_invoice_file"
        promptText="New Invoice Photo:"
      />
    </td>
  );
};
