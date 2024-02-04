import { ReactElement } from 'react';
import { format } from 'date-fns';
import { AllChargesDateFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesDateFields on Charge {
    id
    minEventDate
    minDebitDate
    minDocumentsDate
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesDateFieldsFragmentDoc>;
};

export const DateCell = ({ data }: Props): ReactElement => {
  const charge = getFragmentData(AllChargesDateFieldsFragmentDoc, data);
  const { minDebitDate, minEventDate, minDocumentsDate } = charge;
  const hasDate = minDebitDate || minEventDate || minDocumentsDate;

  return (
    <td>
      <div>
        {hasDate && format(new Date(minDocumentsDate || minDebitDate || minEventDate), 'dd/MM/yy')}
      </div>
    </td>
  );
};
