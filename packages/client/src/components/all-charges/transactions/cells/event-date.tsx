import { ReactElement } from 'react';
import { format } from 'date-fns';
import { TransactionsTableEventDateFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';

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
    <td>
      <div>{eventDate && format(new Date(eventDate), 'dd/MM/yy')}</div>
    </td>
  );
};
