import { CSSProperties } from 'react';
import { entitiesWithoutInvoice, entitiesWithoutInvoiceNumuber } from '../../../helpers';
import gql from 'graphql-tag';
import { InvoiceNumberFieldsFragment } from '../../../__generated__/types';

gql`
  fragment invoiceNumberFields on Charge {
    invoice {
      ... on Invoice {
        serialNumber
        id
      }
      ... on InvoiceReceipt {
        serialNumber
        id
      }
    }
  }
`;

type Props = {
  data: InvoiceNumberFieldsFragment;
  isBusiness: boolean;
  financialEntityName: string;
  style?: CSSProperties;
};

export const InvoiceNumber = ({ data, isBusiness, financialEntityName, style }: Props) => {
  const {serialNumber} = data.invoice ?? {};
  const indicator =
  isBusiness && !entitiesWithoutInvoice.includes(financialEntityName) && 
    !entitiesWithoutInvoiceNumuber.includes(financialEntityName) &&
    !serialNumber;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {serialNumber ?? 'null'}
      {/* TODO: create update document hook */}
      {/* <UpdateButton transaction={transaction} propertyName="tax_invoice_number" promptText="New Invoice Number:" /> */}
    </td>
  );
};
