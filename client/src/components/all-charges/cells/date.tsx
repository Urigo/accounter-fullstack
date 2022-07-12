import gql from 'graphql-tag';
import moment from 'moment';

import { AllChargesDateFieldsFragment } from '../../../__generated__/types';

gql`
  fragment AllChargesDateFields on Charge {
    transactions {
      id
      effectiveDate
    }
  }
`;

type Props = {
  data: AllChargesDateFieldsFragment['transactions']['0'];
};

export const Date = ({ data }: Props) => {
  const { effectiveDate } = data;

  return <div style={{ fontSize: '12px', color: 'gray' }}>{moment(effectiveDate).format('YYYY-MM-DD')}</div>;
};
