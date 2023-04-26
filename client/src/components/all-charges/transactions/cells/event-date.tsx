import { format } from 'date-fns';
import { FragmentType, getFragmentData } from '../../../../gql';
import { TransactionsTableEventDateFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment TransactionsTableEventDateFields on Transaction {
    id
    ...on CommonTransaction {
      createdAt
    }
  }
`;

type Props = {
  data: FragmentType<typeof TransactionsTableEventDateFieldsFragmentDoc>;
};

export const EventDate = ({ data }: Props) => {
  const transaction = getFragmentData(TransactionsTableEventDateFieldsFragmentDoc, data);
  const eventDate = 'createdAt' in transaction ? transaction.createdAt : undefined;

  return (
    <td>
      <div>{eventDate && format(new Date(eventDate), 'dd/MM/yy')}</div>
    </td>
  );
};
