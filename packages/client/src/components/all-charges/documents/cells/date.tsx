import { ReactElement } from 'react';
import { format } from 'date-fns';
import { Indicator } from '@mantine/core';
import { DocumentsDateFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
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
`;

type Props = {
  data: FragmentType<typeof DocumentsDateFieldsFragmentDoc>;
};

export const DateCell = ({ data }: Props): ReactElement => {
  const document = getFragmentData(DocumentsDateFieldsFragmentDoc, data);
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
