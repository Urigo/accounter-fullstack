import { type ReactElement } from 'react';
import { TransactionsTableEventDateFieldsFragmentDoc } from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { formatTimelessDate } from '../../../helpers/index.js';
import { TableCell } from '../../ui/table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TransactionsTableEventDateFields on Transaction {
    id
    eventDate
  }
`;

type Props = {
  data: FragmentType<typeof TransactionsTableEventDateFieldsFragmentDoc>;
};

export const EventDate = ({ data }: Props): ReactElement => {
  const transaction = getFragmentData(TransactionsTableEventDateFieldsFragmentDoc, data);
  const eventDate = 'eventDate' in transaction ? transaction.eventDate : undefined;

  return (
    <TableCell>
      <div className="flex flex-col justify-center">
        {eventDate && formatTimelessDate(eventDate)}
      </div>
    </TableCell>
  );
};
