import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesDateFieldsFragmentDoc } from '../../../gql/graphql';
import { clearTimeFromDate } from '../../../helpers';

/* GraphQL */ `
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
  data: FragmentType<typeof AllChargesDateFieldsFragmentDoc>;
};

export const Date = ({ data }: Props) => {
  const charge = getFragmentData(AllChargesDateFieldsFragmentDoc, data);
  const { effectiveDate, createdAt } = charge.transactions[0];
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
