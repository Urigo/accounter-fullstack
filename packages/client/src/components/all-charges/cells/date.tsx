import { ReactElement } from 'react';
import { format } from 'date-fns';
import { AllChargesDateFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesDateFields on Charge {
    id
    minEventDate
    minDocumentsDate
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesDateFieldsFragmentDoc>;
};

export const DateCell = ({ data }: Props): ReactElement => {
  const charge = getFragmentData(AllChargesDateFieldsFragmentDoc, data);
  const { minEventDate, minDocumentsDate } = charge;

  return (
    <td>
      <div>{minEventDate && format(new Date(minDocumentsDate || minEventDate), 'dd/MM/yy')}</div>
    </td>
  );
};
