import { gql } from 'graphql-modules';

export const financialAccountsSchema = gql`
  " Represent something external that we scrape, like bank or card "
  interface FinancialAccount {
    id: ID!
  }

  " represent a single bank account"
  type BankFinancialAccount implements FinancialAccount {
    id: ID!
    " the external identifier of the bank account "
    accountNumber: String!
    bankNumber: String!
    branchNumber: String!
    " calculate based on bank+branch "
    routingNumber: String!
    " the external identifier of the bank account "
    iban: IBAN!
    " swift "
    swift: String!
    " country "
    country: String!
    " the name of the bank account"
    name: String
  }

  " represent a single credit card "
  type CardFinancialAccount implements FinancialAccount {
    id: ID!
    " the external identifier of the card "
    number: String!
    fourDigits: String!
  }

  extend type LtdFinancialEntity {
    accounts: [FinancialAccount!]!
  }

  extend type PersonalFinancialEntity {
    accounts: [FinancialAccount!]!
  }

  extend interface FinancialEntity {
    accounts: [FinancialAccount!]!
  }
`;
