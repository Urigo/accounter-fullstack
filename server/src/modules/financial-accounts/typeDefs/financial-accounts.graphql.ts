import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    allFinancialAccounts: [FinancialAccount!]!
  }

  " Represent something external that we scrape, like bank or card "
  interface FinancialAccount {
    id: ID!
    " the name of the account"
    name: String!
    " the general type of the account"
    type: String!
  }

  " represent a single bank account"
  type BankFinancialAccount implements FinancialAccount {
    id: ID!
    name: String!
    type: String!
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
  }

  " represent a single credit card "
  type CardFinancialAccount implements FinancialAccount {
    id: ID!
    name: String!
    type: String!
    " the external identifier of the card "
    number: String!
    fourDigits: String!
  }

  " represent a single credit card "
  type CryptoWalletFinancialAccount implements FinancialAccount {
    id: ID!
    name: String!
    type: String!
    " the external identifier of the wallet "
    number: String!
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
