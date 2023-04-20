import { FragmentType, getFragmentData } from '../../../../gql';
import { Transactions_AmountFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment Transactions_AmountFields on Transaction {
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
  data: FragmentType<typeof Transactions_AmountFieldsFragmentDoc>;
};

export const Amount = ({ data }: Props) => {
  const transaction = getFragmentData(Transactions_AmountFieldsFragmentDoc, data);
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
