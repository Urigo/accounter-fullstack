import gql from 'graphql-tag';

import { AllChargesAccountFieldsFragment } from '../../../__generated__/types';

gql`
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
  data: AllChargesAccountFieldsFragment['transactions'][0];
};

// TODO: this is temp. delete this cell after all_transaction is split into ledger and charge
export const Account = ({ data }: Props) => {
  const { account } = data;

  const accountType =
    account.__typename === 'BankFinancialAccount'
      ? 'Bank'
      : account.__typename === 'CardFinancialAccount'
      ? 'Card'
      : undefined;
  const accountNumber = account.__typename === 'BankFinancialAccount' ? account.accountNumber : account.fourDigits;

  return (
    <div className="flex flex-col gap-2 items-center">
      <p>{accountNumber}</p>
      <p>{accountType}</p>
    </div>
  );
};
