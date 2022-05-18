import { CSSProperties } from 'react';
import { entitiesWithoutInvoice } from '../../../helpers';
import gql from 'graphql-tag';
import { InvoiceFileFieldsFragment } from '../../../__generated__/types';

gql`
  fragment invoiceFileFields on Charge {
    invoice {
      ... on Document {
        file
        id
      }
    }
  }
`;

type Props = {
  data: InvoiceFileFieldsFragment;
  isBusiness: boolean;
  financialEntityName: string;
  style?: CSSProperties;
};

export const InvoiceFile = ({ data, isBusiness, financialEntityName, style }: Props) => {
  const { file } = data.invoice ?? {};
  const indicator = isBusiness && !entitiesWithoutInvoice.includes(financialEntityName) && !file;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {file && (
        <a href={file} rel="noreferrer" target="_blank">
          yes
        </a>
      )}
      {/* TODO: create update document hook */}
      {/* <UpdateButton transaction={transaction} propertyName="tax_invoice_file" promptText="New Invoice path:" /> */}
    </td>
  );
};
