import { format } from 'date-fns';
import { FragmentType, getFragmentData } from '../../../../gql';
import { LedgerRecordsDateFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment LedgerRecordsDateFields on LedgerRecord {
    id
    invoiceDate
  }
`;

type Props = {
  data: FragmentType<typeof LedgerRecordsDateFieldsFragmentDoc>;
};

export const DateCell = ({ data }: Props) => {
  const { invoiceDate } = getFragmentData(LedgerRecordsDateFieldsFragmentDoc, data);

  const formattedDate = invoiceDate ? format(new Date(invoiceDate), 'dd/MM/yy') : 'Missing Data';

  return <td>{formattedDate}</td>;
};
