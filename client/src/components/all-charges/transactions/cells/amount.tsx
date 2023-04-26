import { FragmentType, getFragmentData } from '../../../../gql';
import { TransactionsTableAmountFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment TransactionsTableAmountFields on Transaction {
    id
    ...on CommonTransaction {
      amount {
        raw
        formatted
    }
    }
  }
`;

type Props = {
  data: FragmentType<typeof TransactionsTableAmountFieldsFragmentDoc>;
};

export const Amount = ({ data }: Props) => {
  const transaction = getFragmentData(TransactionsTableAmountFieldsFragmentDoc, data);
  const amount = 'amount' in transaction ? transaction.amount : undefined;

  return (
    <td>
      <div
        style={{
          color: Number(amount?.raw) > 0 ? 'green' : 'red',
          whiteSpace: 'nowrap',
        }}
      >
        {amount?.formatted}
      </div>
    </td>
  );
};
