import { graphql } from '../../../graphql.js';

export const AllFinancialAccountsDocument = graphql(`
  query AllFinancialAccounts {
    allFinancialAccounts {
      __typename
      id
      ... on BankFinancialAccount {
        name
      }
      ... on CardFinancialAccount {
        name
      }
      ... on CryptoWalletFinancialAccount {
        name
      }
    }
  }
`);
