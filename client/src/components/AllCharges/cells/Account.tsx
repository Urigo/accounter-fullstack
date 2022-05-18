import { CSSProperties, FC } from 'react';
import gql from 'graphql-tag';
import { AccountFieldsFragment } from '../../../__generated__/types';

gql`
  fragment accountFields on Charge {
    transactions {
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
  account: AccountFieldsFragment['transactions'][0]['account'];
  style?: CSSProperties;
};

export const Account: FC<Props> = ({ account, style }) => {
  const accountType =
    account.__typename === 'BankFinancialAccount'
      ? 'Bank'
      : account.__typename === 'CardFinancialAccount'
      ? 'Card'
      : undefined;
  const accountNumber = account.__typename === 'BankFinancialAccount' ? account.accountNumber : account.fourDigits;
  return (
    <td style={{ ...style }}>
      {accountNumber}
      {accountType}
    </td>
  );
};
