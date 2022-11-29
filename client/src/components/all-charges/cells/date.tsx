import gql from 'graphql-tag';

import { AllChargesDateFieldsFragment } from '../../../__generated__/types';
import { clearTimeFromDate } from '../../../helpers';

gql`
  fragment AllChargesDateFields on Charge {
    id
    transactions {
      id
      createdAt
      effectiveDate
    }
  }
`;

type Props = {
  data: AllChargesDateFieldsFragment['transactions']['0'];
};

export const Date = ({ data }: Props) => {
  const { effectiveDate, createdAt } = data;
  const timelessCreatedAt = clearTimeFromDate(createdAt);
  const timelessEffectiveDate = clearTimeFromDate(effectiveDate);

  return (
    <div>
      <div style={{ fontSize: '12px', color: 'gray' }}>{timelessCreatedAt}</div>
      {timelessEffectiveDate && timelessEffectiveDate !== timelessCreatedAt && (
        <div style={{ fontSize: '10px', color: 'darkGray' }}>{timelessEffectiveDate}</div>
      )}
    </div>
  );
};
