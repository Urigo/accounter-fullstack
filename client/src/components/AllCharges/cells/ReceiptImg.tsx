import { CSSProperties } from 'react';
import { UpdateButton } from '../../common';
import { entitiesWithoutInvoice } from '../../../helpers';
import gql from 'graphql-tag';
import { ReceiptImageFieldsFragment } from '../../../__generated__/types';

gql`
  fragment receiptImageFields on Charge {
    receipt {
      ... on Document {
        id
        image
      }
    }
    invoice {
      ... on Document {
        image
      }
    }
  }
`;

type Props = {
  data: ReceiptImageFieldsFragment;
  isBusiness: boolean;
  financialEntityName: string;
  style?: CSSProperties;
};

export const ReceiptImg = ({ data, isBusiness, financialEntityName, style }: Props) => {
  const image = data.invoice?.image;
  const indicator =
    isBusiness && !entitiesWithoutInvoice.includes(financialEntityName) && !image && !data.invoice?.image;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {image && (
        <a href={image} rel="noreferrer" target="_blank">
          yes
        </a>
      )}
      {/* TODO: create update document hook */}
      {/* <UpdateButton transaction={transaction} propertyName="receipt_image" promptText="New Receipt Photo:" /> */}
    </td>
  );
};
