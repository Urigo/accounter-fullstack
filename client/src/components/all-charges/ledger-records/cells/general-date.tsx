import gql from 'graphql-tag';
import { LedgerRecordsGeneralDateFieldsFragment } from '../../../../__generated__/types';

/* TEMPORARY: this component is used for temporary reasons */

gql`
  fragment LedgerRecordsGeneralDateFields on LedgerRecord {
    id
    date
    value_date
    date3
  }
`;

type Props = {
  data: LedgerRecordsGeneralDateFieldsFragment;
  type: 1 | 2 | 3;
};

export const GeneralDate = ({ data, type }: Props) => {
  const { date, value_date, date3 } = data;

  const showDate = type === 1 ? date : type === 2 ? value_date : date3;

  return <td>{showDate ?? 'Missing Data'}</td>;
};
