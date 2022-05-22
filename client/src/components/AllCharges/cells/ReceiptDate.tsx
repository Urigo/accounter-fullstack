import moment from 'moment';
import { CSSProperties } from 'react';
import { entitiesWithoutInvoice } from '../../../helpers';
import gql from 'graphql-tag';
import { ReceiptDateFieldsFragment } from '../../../__generated__/types';

gql`
  fragment ReceiptDateFields on Charge {
    receipt {
      ... on Receipt {
        date
        id
      }
      ... on InvoiceReceipt {
        date
        id
      }
    }
  }
`;

type Props = {
  data: ReceiptDateFieldsFragment;
  isBusiness: boolean;
  financialEntityName: string;
  style?: CSSProperties;
};

export const ReceiptDate = ({ data, isBusiness, financialEntityName, style }: Props) => {
  const date = data.receipt?.date as Date | undefined;
  const indicator = isBusiness && !entitiesWithoutInvoice.includes(financialEntityName) && !date;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {date && moment(date).format('DD/MM/YY')}
      {/* TODO: create update document hook */}
      {/* <UpdateButton transaction={transaction} propertyName="receipt_date" promptText="New Receipt Date:" /> */}
    </td>
  );
};
