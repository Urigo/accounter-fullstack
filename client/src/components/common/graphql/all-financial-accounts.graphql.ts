/* GraphQL */ `
  query AllFinancialAccounts {
    allFinancialAccounts {
        __typename
      id
      ... on BankFinancialAccount {
        name
      }
      ... on CardFinancialAccount {
        name: number
      }
    }
  }
`;

export {};
