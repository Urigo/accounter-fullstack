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

export const Date = ({ data }: Props) => {
  const { date } = getFragmentData(LedgerRecordsDateFieldsFragmentDoc, data);

  return <td>{date ?? 'Missing Data'}</td>;
};
