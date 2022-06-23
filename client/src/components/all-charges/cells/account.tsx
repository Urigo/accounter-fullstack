// import gql from 'graphql-tag';
// import { CSSProperties } from 'react';

// import { AccountFieldsFragment } from '../../../__generated__/types';

// gql`
//   fragment AccountFields on Charge {
//     transactions {
//       id
//       account {
//         id
//         __typename
//         ... on BankFinancialAccount {
//           accountNumber
//         }
//         ... on CardFinancialAccount {
//           fourDigits
//         }
//       }
//     }
//   }
// `;

// type Props = {
//   account: AccountFieldsFragment['transactions'][0]['account'];
//   style?: CSSProperties;
// };

// export const Account = ({ account, style }: Props) => {
//   const accountType =
//     account.__typename === 'BankFinancialAccount'
//       ? 'Bank'
//       : account.__typename === 'CardFinancialAccount'
//       ? 'Card'
//       : undefined;
//   const accountNumber = account.__typename === 'BankFinancialAccount' ? account.accountNumber : account.fourDigits;
//   return (
//     <td style={{ ...style }}>
//       {accountNumber}
//       {accountType}
//     </td>
//   );
// };

// NOTE: deprecated
export {}
