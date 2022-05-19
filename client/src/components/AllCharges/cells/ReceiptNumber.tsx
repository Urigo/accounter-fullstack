import { CSSProperties } from 'react';
import { entitiesWithoutInvoice, entitiesWithoutInvoiceNumuber } from '../../../helpers';
import gql from 'graphql-tag';
import { ReceiptNumberFieldsFragment } from '../../../__generated__/types';

gql`
  fragment receiptNumberFields on Charge {
    receipt {
      ... on Receipt {
        serialNumber
        id
      }
      ... on InvoiceReceipt {
        serialNumber
        id
      }
    }
    invoice {
      ... on Invoice {
        serialNumber
      }
      ... on InvoiceReceipt {
        serialNumber
      }
    }
  }
`;

type Props = {
  data: ReceiptNumberFieldsFragment;
  isBusiness: boolean;
  financialEntityName: string;
  style?: CSSProperties;
};

export const ReceiptNumber = ({ data, isBusiness, financialEntityName, style }: Props) => {
  const { serialNumber } = data.receipt ?? {};
  const indicator =
    isBusiness &&
    !entitiesWithoutInvoice.includes(financialEntityName) &&
    !entitiesWithoutInvoiceNumuber.includes(financialEntityName) &&
    !serialNumber &&
    data.invoice?.serialNumber;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {serialNumber ?? 'null'}
      {/* TODO: create update document hook */}
      {/* <UpdateButton transaction={transaction} propertyName="receipt_number" promptText="New Receipt Number:" /> */}
    </td>
  );
};
