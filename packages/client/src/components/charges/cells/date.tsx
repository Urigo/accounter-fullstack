import { type ReactElement } from 'react';
import { format } from 'date-fns';
import { ChargesTableDateFieldsFragmentDoc } from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableDateFields on Charge {
    id
    minEventDate
    minDebitDate
    minDocumentsDate
    maxEventDate
    maxDebitDate
    maxDocumentsDate
  }
`;

type Props = {
  data: FragmentType<typeof ChargesTableDateFieldsFragmentDoc>;
};

export const DateCell = ({ data }: Props): ReactElement => {
  const charge = getFragmentData(ChargesTableDateFieldsFragmentDoc, data);
  const {
    minDebitDate,
    minEventDate,
    minDocumentsDate,
    maxDebitDate,
    maxEventDate,
    maxDocumentsDate,
  } = charge;
  const displayDate = minDocumentsDate || minEventDate || minDebitDate;
  const minTimestamps = [minDocumentsDate, minEventDate, minDebitDate]
    .filter(Boolean)
    .map(d => new Date(d!).getTime());
  const maxTimestamps = [maxDocumentsDate, maxEventDate, maxDebitDate]
    .filter(Boolean)
    .map(d => new Date(d!).getTime());
  const mostMinDate = minTimestamps.length > 0 ? new Date(Math.min(...minTimestamps)) : null;
  const mostMaxDate = maxTimestamps.length > 0 ? new Date(Math.max(...maxTimestamps)) : null;

  return (
    <td>
      <div>{displayDate && format(new Date(displayDate), 'dd/MM/yy')}</div>
      <div className="text-xs text-gray-500">
        {mostMinDate && mostMaxDate && mostMinDate.getTime() !== mostMaxDate.getTime() ? (
          <>
            ({format(mostMinDate, 'dd/MM/yy')} - {format(mostMaxDate, 'dd/MM/yy')})
          </>
        ) : null}
      </div>
    </td>
  );
};
