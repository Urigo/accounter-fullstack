import { ReactElement } from 'react';
import { format } from 'date-fns';
import { Indicator } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';

export const DocumentsDateFieldsFragmentDoc = graphql(`
  fragment DocumentsDateFields on Document {
    id
    ... on Invoice {
      date
    }
    ... on InvoiceReceipt {
      date
    }
    ... on CreditInvoice {
      date
    }
    ... on Proforma {
      date
    }
    ... on Receipt {
      date
    }
  }
`);

type Props = {
  data: FragmentOf<typeof DocumentsDateFieldsFragmentDoc>;
};

export const DateCell = ({ data }: Props): ReactElement => {
  const document = readFragment(DocumentsDateFieldsFragmentDoc, data);
  const date = 'date' in document ? document.date : undefined;

  const formattedDate = date ? format(new Date(date), 'dd/MM/yy') : 'Missing Data';

  return (
    <td>
      <Indicator inline size={12} disabled={!!date} color="red" zIndex="auto">
        <div>{formattedDate}</div>
      </Indicator>
    </td>
  );
};
