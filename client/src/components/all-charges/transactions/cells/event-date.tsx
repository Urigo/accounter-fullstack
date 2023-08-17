import { format } from 'date-fns';
import { FragmentType, getFragmentData } from '../../../../gql';
import { TransactionsTableEventDateFieldsFragmentDoc } from '../../../../gql/graphql';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TransactionsTableEventDateFields on Transaction {
    id
    ...on CommonTransaction {
      eventDate
    }
  }
`;

type Props = {
  data: FragmentType<typeof TransactionsTableEventDateFieldsFragmentDoc>;
};

export const EventDate = ({ data }: Props) => {
  const transaction = getFragmentData(TransactionsTableEventDateFieldsFragmentDoc, data);
  const eventDate = 'eventDate' in transaction ? transaction.eventDate : undefined;

  return (
    <td>
      <div>{eventDate && format(new Date(eventDate), 'dd/MM/yy')}</div>
    </td>
  );
};
