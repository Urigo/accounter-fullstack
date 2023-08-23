import { ReactElement } from 'react';
import { TransactionsTableAmountFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
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

export const Amount = ({ data }: Props): ReactElement => {
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
