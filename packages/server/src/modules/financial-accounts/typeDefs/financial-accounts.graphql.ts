import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    allFinancialAccounts: [FinancialAccount!]! @requiresAuth
    financialAccountsByOwner(ownerId: UUID!): [FinancialAccount!]! @requiresAuth
    financialAccount(id: UUID!): FinancialAccount! @requiresAuth
  }

  extend type Mutation {
    deleteFinancialAccount(id: UUID!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    createFinancialAccount(input: CreateFinancialAccountInput!): FinancialAccount!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateFinancialAccount(id: UUID!, fields: UpdateFinancialAccountInput!): FinancialAccount!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
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
    " account's tax categories per currency "
    accountTaxCategories: [CurrencyTaxCategory!]!
  }

  " extended type for currency tax category linked to financial account "
  type CurrencyTaxCategory {
    id: ID!
    currency: Currency!
    taxCategory: TaxCategory!
  }

  " represent a single credit card "
  type CardFinancialAccount implements FinancialAccount {
    id: UUID!
    name: String!
    type: FinancialAccountType!
    privateOrBusiness: PrivateOrBusinessType!
    accountTaxCategories: [CurrencyTaxCategory!]!
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
    accountTaxCategories: [CurrencyTaxCategory!]!
    " the external identifier of the wallet "
    number: String!
  }

  " represent a foreign securities account "
  type ForeignSecuritiesFinancialAccount implements FinancialAccount {
    id: UUID!
    name: String!
    type: FinancialAccountType!
    privateOrBusiness: PrivateOrBusinessType!
    accountTaxCategories: [CurrencyTaxCategory!]!
    number: String!
  }

  " represent a bank deposit account "
  type BankDepositFinancialAccount implements FinancialAccount {
    id: UUID!
    name: String!
    type: FinancialAccountType!
    privateOrBusiness: PrivateOrBusinessType!
    accountTaxCategories: [CurrencyTaxCategory!]!
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
    currencies: [FinancialAccountCurrencyInput!]
  }

  " input type for updating a financial account "
  input UpdateFinancialAccountInput {
    number: String
    name: String
    ownerId: UUID
    type: FinancialAccountType
    privateOrBusiness: PrivateOrBusinessType
    bankAccountDetails: BankAccountUpdateInput
    currencies: [FinancialAccountCurrencyInput!]
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

  " input type for financial account currency and tax category "
  input FinancialAccountCurrencyInput {
    currency: Currency!
    taxCategoryId: UUID!
  }
`;
