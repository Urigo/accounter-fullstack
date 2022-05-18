import { CSSProperties } from 'react';
import { entitiesWithoutInvoice } from '../../../helpers';
import gql from 'graphql-tag';
import { ReceiptUrlFieldsFragment } from '../../../__generated__/types';

gql`
  fragment receiptUrlFields on Charge {
    receipt {
      ... on Document {
        file
        id
      }
    }
  }
`;

type Props = {
  data: ReceiptUrlFieldsFragment;
  isBusiness: boolean;
  financialEntityName: string;
  style?: CSSProperties;
};

export const ReceiptUrl = ({ data, isBusiness, financialEntityName, style }: Props) => {
  const { file } = data.receipt ?? {};
  const indicator = isBusiness && !entitiesWithoutInvoice.includes(financialEntityName) && !file && !data.invoice?.file;

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
      {/* <UpdateButton transaction={transaction} propertyName="receipt_url" promptText="New Receipt url:" /> */}
    </td>
  );
};
