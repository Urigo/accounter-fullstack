import { CSSProperties } from 'react';
import { entitiesWithoutInvoice } from '../../../helpers';
import gql from 'graphql-tag';
import { ReceiptUrlFieldsFragment } from '../../../__generated__/types';
import { RegularButton } from '../../common/ButtonImage';
import { AccounterButton } from '../../common/Button';

gql`
  fragment ReceiptUrlFields on Charge {
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
  const indicator = isBusiness && !entitiesWithoutInvoice.includes(financialEntityName) && !file && !data.receipt?.file;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {file && <AccounterButton target="_blank" rel="noreferrer" herf={file} title="Open Link" />}
      {/* TODO: create update document hook */}
      {/* <UpdateButton transaction={transaction} propertyName="receipt_url" promptText="New Receipt url:" /> */}
    </td>
  );
};
