// import gql from 'graphql-tag';
import { LedgerRecordsDateFieldsFragment } from '../../../../__generated__/types';

// gql`
//   fragment LedgerRecordsDateFields on LedgerRecord {
//     id
//     date
//   }
// `;

type Props = {
  data: LedgerRecordsDateFieldsFragment;
};

export const Date = ({ data }: Props) => {
  const { date } = data;

  return <td>{date ?? 'Missing Data'}</td>;
};
