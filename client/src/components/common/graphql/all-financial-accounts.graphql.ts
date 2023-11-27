// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
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
`;

export {};
