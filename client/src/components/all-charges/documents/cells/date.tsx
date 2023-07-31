import { format } from 'date-fns';
import { Indicator } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../../gql';
import { DocumentsDateFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment DocumentsDateFields on Document {
    id
    ... on Invoice {
      date
    }
    ... on InvoiceReceipt {
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

export const DateCell = ({ data }: Props) => {
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
