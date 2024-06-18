import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    business(id: UUID!): Business! @auth(role: ACCOUNTANT)
    " TODO: This is temporary & should be replaced after auth and financial entities hierarchy is implemented "
    allBusinesses(page: Int, limit: Int, name: String): PaginatedBusinesses @auth(role: ACCOUNTANT)
  }

  " represent a financial entity of any type that may hold financial accounts (company, business, individual) "
  interface Business implements FinancialEntity {
    id: UUID!
    name: String!
  }

  " response for paginated Financial Entities "
  type PaginatedBusinesses {
    nodes: [Business!]!
    pageInfo: PageInfo!
  }

  " Financial entity, identifier by ID, can be a company or individual "
  type LtdFinancialEntity implements FinancialEntity & Business {
    id: UUID!
    governmentId: String
    name: String!
    address: String

    hebrewName: String
    email: String
    website: String
    phoneNumber: String
    exemptDealer: Boolean
  }

  " Financial entity, identifier by ID, represents an actual person "
  type PersonalFinancialEntity implements FinancialEntity & Business {
    id: UUID!
    name: String!
    email: String!
  }

  extend type Mutation {
    updateBusiness(
      businessId: UUID!
      ownerId: UUID!
      fields: UpdateBusinessInput!
    ): UpdateBusinessResponse! @auth(role: ACCOUNTANT)
    insertNewBusiness(fields: InsertNewBusinessInput!): UpdateBusinessResponse!
      @auth(role: ACCOUNTANT)
  }

  " result type for updateBusiness "
  union UpdateBusinessResponse = LtdFinancialEntity | CommonError

  " input for updateBusiness "
  input UpdateBusinessInput {
    name: String
    sortCode: Int

    hebrewName: String
    address: String
    email: String
    website: String
    phoneNumber: String
    governmentId: String
    taxCategory: UUID
    exemptDealer: Boolean
  }

  " input for insertNewBusiness "
  input InsertNewBusinessInput {
    name: String!
    sortCode: Int

    hebrewName: String
    address: String
    email: String
    website: String
    phoneNumber: String
    governmentId: String
    taxCategory: UUID
    exemptDealer: Boolean
    suggestions: SuggestionsInput
  }

  " input for business suggestions "
  input SuggestionsInput {
    phrases: [String!]!
    tags: [TagInput!]!
    description: String
  }

  extend interface Charge {
    " the financial entity that created the charge "
    owner: Business!
  }

  extend type CommonCharge {
    owner: Business!
  }

  extend type ConversionCharge {
    owner: Business!
  }

  extend type SalaryCharge {
    owner: Business!
  }

  extend type InternalTransferCharge {
    owner: Business!
  }

  extend type DividendCharge {
    owner: Business!
  }

  extend type BusinessTripCharge {
    owner: Business!
  }

  extend type MonthlyVatCharge {
    owner: Business!
  }

  extend type BankDepositCharge {
    owner: Business!
  }
`;
