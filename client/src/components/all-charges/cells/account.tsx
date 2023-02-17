import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesAccountFieldsFragmentDoc } from '../../../gql/graphql';

/* GraphQL */ `
  fragment AllChargesAccountFields on Charge {
    id
    transactions {
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
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesAccountFieldsFragmentDoc>;
};

// TODO: this is temp. delete this cell after all_transaction is split into ledger and charge
export const Account = ({ data }: Props) => {
  const charge = getFragmentData(AllChargesAccountFieldsFragmentDoc, data);
  const { account } = charge.transactions[0];

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
