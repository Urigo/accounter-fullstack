import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    allFinancialAccounts: [FinancialAccount!]!
  }

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
    name: String!
  }

  " represent a single credit card "
  type CardFinancialAccount implements FinancialAccount {
    id: ID!
    " the external identifier of the card "
    number: String!
    fourDigits: String!
  }

  extend interface Transaction {
    " link to the account "
    account: FinancialAccount!
  }

  extend type CommonTransaction {
    account: FinancialAccount!
  }

  extend type WireTransaction {
    account: FinancialAccount!
  }

  extend type FeeTransaction {
    account: FinancialAccount!
  }

  extend type ConversionTransaction {
    account: FinancialAccount!
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
