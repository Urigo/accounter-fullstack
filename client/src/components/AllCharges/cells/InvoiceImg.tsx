import { CSSProperties, FC } from 'react';
import { entitiesWithoutInvoice } from '../../../helpers';
import gql from 'graphql-tag';
import { InvoiceImageFieldsFragment } from '../../../__generated__/types';

gql`
  fragment invoiceImageFields on Charge {
    invoice {
      ... on Document {
        id
        image
      }
    }
  }
`;

type Props = {
  data: InvoiceImageFieldsFragment;
  isBusiness: boolean;
  financialEntityName: string;
  style?: CSSProperties;
};

export const InvoiceImg: FC<Props> = ({ data, isBusiness, financialEntityName, style }) => {
  const image = data.invoice?.image;
  const indicator = isBusiness && !entitiesWithoutInvoice.includes(financialEntityName) && !image;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {image && (
        <a href={image as string} rel="noreferrer" target="_blank">
          yes
        </a>
      )}
      {/* TODO: create update document hook */}
      {/* <UpdateButton transaction={transaction} propertyName="proforma_invoice_file" promptText="New Invoice Photo:" /> */}
    </td>
  );
};
