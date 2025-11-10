import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    allFinancialAccounts: [FinancialAccount!]! @auth(role: ACCOUNTANT)
    financialAccountsByOwner(ownerId: UUID!): [FinancialAccount!]! @auth(role: ACCOUNTANT)
    financialAccount(id: UUID!): FinancialAccount! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    deleteFinancialAccount(id: UUID!): Boolean! @auth(role: ACCOUNTANT)
    createFinancialAccount(input: CreateFinancialAccountInput!): FinancialAccount!
      @auth(role: ACCOUNTANT)
    updateFinancialAccount(id: UUID!, fields: UpdateFinancialAccountInput!): FinancialAccount!
      @auth(role: ACCOUNTANT)
  }

  " Represent something external that we scrape, like bank or card "
  interface FinancialAccount {
    id: UUID!
    " the name of the account"
    name: String!
    " Account number "
    number: String!
    " the general type of the account"
    type: FinancialAccountType!
    " indicates if the account is private or business "
    privateOrBusiness: PrivateOrBusinessType!
  }

  " represent a single credit card "
  type CardFinancialAccount implements FinancialAccount {
    id: UUID!
    name: String!
    type: FinancialAccountType!
    privateOrBusiness: PrivateOrBusinessType!
    " the external identifier of the card "
    number: String!
    fourDigits: String!
  }

  " represent a single credit card "
  type CryptoWalletFinancialAccount implements FinancialAccount {
    id: UUID!
    name: String!
    type: FinancialAccountType!
    privateOrBusiness: PrivateOrBusinessType!
    " the external identifier of the wallet "
    number: String!
  }

  " represent a foreign securities account "
  type ForeignSecuritiesFinancialAccount implements FinancialAccount {
    id: UUID!
    name: String!
    type: FinancialAccountType!
    privateOrBusiness: PrivateOrBusinessType!
    number: String!
  }

  " represent a bank deposit account "
  type BankDepositFinancialAccount implements FinancialAccount {
    id: UUID!
    name: String!
    type: FinancialAccountType!
    privateOrBusiness: PrivateOrBusinessType!
    number: String!
  }

  " input type for creating a financial account "
  input CreateFinancialAccountInput {
    number: String!
    name: String!
    ownerId: UUID!
    type: FinancialAccountType!
    privateOrBusiness: PrivateOrBusinessType!
    bankAccountDetails: BankAccountInsertInput
  }

  " input type for updating a financial account "
  input UpdateFinancialAccountInput {
    number: String
    name: String
    ownerId: UUID
    type: FinancialAccountType
    privateOrBusiness: PrivateOrBusinessType
    bankAccountDetails: BankAccountUpdateInput
  }

  extend interface Transaction {
    " link to the account "
    account: FinancialAccount!
  }

  extend type CommonTransaction {
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

  extend interface Business {
    accounts: [FinancialAccount!]!
  }

  " general types of financial accounts "
  enum FinancialAccountType {
    BANK_ACCOUNT
    CREDIT_CARD
    CRYPTO_WALLET
    BANK_DEPOSIT_ACCOUNT
    FOREIGN_SECURITIES
  }

  " private or business account type "
  enum PrivateOrBusinessType {
    PRIVATE
    BUSINESS
  }
`;
