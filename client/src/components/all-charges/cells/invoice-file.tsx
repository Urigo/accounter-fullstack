import gql from 'graphql-tag';
import { CSSProperties } from 'react';

import { InvoiceFileFieldsFragment } from '../../../__generated__/types';
import { entitiesWithoutInvoice } from '../../../helpers';
import { AccounterButton } from '../../common/button';

gql`
  fragment InvoiceFileFields on Charge {
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
      {file && <AccounterButton target="_blank" rel="noreferrer" herf={file} title="Click Here" />}
      {/* TODO: create update document hook */}
      {/* <UpdateButton transaction={transaction} propertyName="tax_invoice_file" promptText="New Invoice path:" /> */}
    </td>
  );
};
