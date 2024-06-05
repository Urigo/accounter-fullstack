import { ReactElement } from 'react';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';

export const TransactionsTableAccountFieldsFragmentDoc = graphql(`
  fragment TransactionsTableAccountFields on Transaction {
    id
    account {
      id
      __typename
      name
      type
    }
  }
`);

type Props = {
  data: FragmentOf<typeof TransactionsTableAccountFieldsFragmentDoc>;
};

export const Account = ({ data }: Props): ReactElement => {
  const transaction = readFragment(TransactionsTableAccountFieldsFragmentDoc, data);
  const { account } = transaction;

  const accountType = account.type;
  const accountName = account.name;

  return (
    <td>
      <div className="flex flex-col gap-2 items-center">
        <p>{accountType}</p>
        <p>{accountName}</p>
      </div>
    </td>
  );
};
