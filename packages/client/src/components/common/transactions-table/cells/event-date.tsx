import { ReactElement } from 'react';
import { format } from 'date-fns';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';

export const TransactionsTableEventDateFieldsFragmentDoc = graphql(`
  fragment TransactionsTableEventDateFields on Transaction {
    id
    eventDate
  }
`);

type Props = {
  data: FragmentOf<typeof TransactionsTableEventDateFieldsFragmentDoc>;
};

export const EventDate = ({ data }: Props): ReactElement => {
  const transaction = readFragment(TransactionsTableEventDateFieldsFragmentDoc, data);
  const eventDate = 'eventDate' in transaction ? transaction.eventDate : undefined;

  return (
    <td>
      <div>{eventDate && format(new Date(eventDate), 'dd/MM/yy')}</div>
    </td>
  );
};
