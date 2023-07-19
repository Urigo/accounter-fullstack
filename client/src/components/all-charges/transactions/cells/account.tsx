import { FragmentType, getFragmentData } from '../../../../gql';
import { TransactionsTableAccountFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment TransactionsTableAccountFields on Transaction {
    id
    account {
        id
        __typename
        ... on BankFinancialAccount {
            accountNumber
        }
        ... on CardFinancialAccount {
            fourDigits
        }
    }
  }
`;

type Props = {
  data: FragmentType<typeof TransactionsTableAccountFieldsFragmentDoc>;
};

export const Account = ({ data }: Props) => {
  const transaction = getFragmentData(TransactionsTableAccountFieldsFragmentDoc, data);
  const { account } = transaction;

  const accountType =
    account.__typename === 'BankFinancialAccount'
      ? 'Bank'
      : account.__typename === 'CardFinancialAccount'
      ? 'Card'
      : undefined;
  const accountNumber =
    account.__typename === 'BankFinancialAccount' ? account.accountNumber : account.fourDigits;

  return (
    <td>
      <div className="flex flex-col gap-2 items-center">
        <p>{accountNumber}</p>
        <p>{accountType}</p>
      </div>
    </td>
  );
};
