import { ReactElement } from 'react';
import { TransactionsTableAccountFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TransactionsTableAccountFields on Transaction {
    id
    account {
      id
      __typename
      name
      type
    }
  }
`;

type Props = {
  data: FragmentType<typeof TransactionsTableAccountFieldsFragmentDoc>;
};

export const Account = ({ data }: Props): ReactElement => {
  const transaction = getFragmentData(TransactionsTableAccountFieldsFragmentDoc, data);
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
