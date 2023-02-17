import { format } from 'date-fns';
import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesDateFieldsFragmentDoc } from '../../../gql/graphql';

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

export const DateCell = ({ data }: Props) => {
  const charge = getFragmentData(AllChargesDateFieldsFragmentDoc, data);
  const { effectiveDate, createdAt } = charge.transactions[0];
  const timelessCreatedAt = format(new Date(createdAt), 'dd/MM/yy');
  const timelessEffectiveDate = format(new Date(effectiveDate as string), 'dd/MM/yy');

  return (
    <td>
      <div>
        {timelessCreatedAt}
        {timelessEffectiveDate && timelessEffectiveDate !== timelessCreatedAt && (
          <div style={{ fontSize: '12px', color: 'darkGray' }}>{timelessEffectiveDate}</div>
        )}
      </div>
    </td>
  );
};
