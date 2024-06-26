import { ReactElement } from 'react';
import { format } from 'date-fns';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';

export const AllChargesDateFieldsFragmentDoc = graphql(`
  fragment AllChargesDateFields on Charge {
    id
    minEventDate
    minDebitDate
    minDocumentsDate
  }
`);

type Props = {
  data: FragmentOf<typeof AllChargesDateFieldsFragmentDoc>;
};

export const DateCell = ({ data }: Props): ReactElement => {
  const charge = readFragment(AllChargesDateFieldsFragmentDoc, data);
  const { minDebitDate, minEventDate, minDocumentsDate } = charge;
  const displayDate = minDebitDate || minEventDate || minDocumentsDate;

  return (
    <td>
      <div>{displayDate && format(new Date(displayDate), 'dd/MM/yy')}</div>
    </td>
  );
};
