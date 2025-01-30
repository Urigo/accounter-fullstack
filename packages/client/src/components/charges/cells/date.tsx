import { ReactElement } from 'react';
import { format } from 'date-fns';
import { ChargesTableDateFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableDateFields on Charge {
    id
    minEventDate
    minDebitDate
    minDocumentsDate
  }
`;

type Props = {
  data: FragmentType<typeof ChargesTableDateFieldsFragmentDoc>;
};

export const DateCell = ({ data }: Props): ReactElement => {
  const charge = getFragmentData(ChargesTableDateFieldsFragmentDoc, data);
  const { minDebitDate, minEventDate, minDocumentsDate } = charge;
  const displayDate = minDebitDate || minEventDate || minDocumentsDate;

  return <div>{displayDate && format(new Date(displayDate), 'dd/MM/yy')}</div>;
};
