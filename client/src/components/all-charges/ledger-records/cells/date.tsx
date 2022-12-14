import { format } from 'date-fns';
import { FragmentType, getFragmentData } from '../../../../gql';
import { LedgerRecordsDateFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment LedgerRecordsDateFields on LedgerRecord {
    id
    date
  }
`;

type Props = {
  data: FragmentType<typeof LedgerRecordsDateFieldsFragmentDoc>;
};

export const DateCell = ({ data }: Props) => {
  const { date } = getFragmentData(LedgerRecordsDateFieldsFragmentDoc, data);

  const formattedDate = date ? format(new Date(date), 'dd/MM/yy') : 'Missing Data';

  return <td>{formattedDate}</td>;
};
