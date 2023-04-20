import { FragmentType, getFragmentData } from '../../../../gql';
import { Transactions_AccountFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment Transactions_AccountFields on Transaction {
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
  data: FragmentType<typeof Transactions_AccountFieldsFragmentDoc>;
};

// TODO: this is temp. delete this cell after all_transaction is split into ledger and charge
export const Account = ({ data }: Props) => {
  const transaction = getFragmentData(Transactions_AccountFieldsFragmentDoc, data);
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
