import { format } from 'date-fns';
import { FragmentType, getFragmentData } from '../../../../gql';
import { Transactions_EventDateFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment Transactions_EventDateFields on Transaction {
    id
    ...on CommonTransaction {
      createdAt
    }
  }
`;

type Props = {
  data: FragmentType<typeof Transactions_EventDateFieldsFragmentDoc>;
};

export const EventDate = ({ data }: Props) => {
  const transaction = getFragmentData(Transactions_EventDateFieldsFragmentDoc, data);
  const eventDate = 'createdAt' in transaction ? transaction.createdAt : undefined;

  return (
    <td>
      <div>{eventDate && format(new Date(eventDate), 'dd/MM/yy')}</div>
    </td>
  );
};
