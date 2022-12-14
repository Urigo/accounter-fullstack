import { format } from 'date-fns';
import { FragmentType, getFragmentData } from '../../../../gql';
import { LedgerRecordsGeneralDateFieldsFragmentDoc } from '../../../../gql/graphql';

/* TEMPORARY: this component is used for temporary reasons */

/* GraphQL */ `
  fragment LedgerRecordsGeneralDateFields on LedgerRecord {
    id
    date
    value_date
    date3
  }
`;

type Props = {
  data: FragmentType<typeof LedgerRecordsGeneralDateFieldsFragmentDoc>;
  type: 1 | 2 | 3;
};

export const GeneralDate = ({ data, type }: Props) => {
  const { date, value_date, date3 } = getFragmentData(
    LedgerRecordsGeneralDateFieldsFragmentDoc,
    data,
  );

  const showDate = type === 1 ? date : type === 2 ? value_date : date3;

  const formattedDate = date ? format(new Date(showDate), 'dd/MM/yy') : 'Missing Data';

  return <td>{formattedDate}</td>;
};
