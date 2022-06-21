import gql from 'graphql-tag';
import moment from 'moment';
import { CSSProperties } from 'react';

import { InvoiceDateFieldsFragment } from '../../../__generated__/types';
import { entitiesWithoutInvoice } from '../../../helpers';

gql`
  fragment InvoiceDateFields on Charge {
    invoice {
      ... on Invoice {
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
  data: InvoiceDateFieldsFragment;
  isBusiness: boolean;
  financialEntityName: string;
  style?: CSSProperties;
};

export const InvoiceDate = ({ data, isBusiness, financialEntityName, style }: Props) => {
  const date = data.invoice?.date as Date | undefined;
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
      {/* <UpdateButton transaction={transaction} propertyName="tax_invoice_date" promptText="New Invoice Date:" /> */}
    </td>
  );
};
