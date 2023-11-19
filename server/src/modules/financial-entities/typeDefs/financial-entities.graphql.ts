import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    financialEntity(id: ID!): FinancialEntity!
    " TODO: This is temporary, should be replaced after auth and financial entities hierarchy is implemented "
    allFinancialEntities(page: Int, limit: Int): PaginatedFinancialEntities
  }

  " response for paginated Financial Entities "
  type PaginatedFinancialEntities {
    nodes: [FinancialEntity!]!
    pageInfo: PageInfo!
  }

  " Financial entity, identifier by ID, can be a company or individual "
  type LtdFinancialEntity implements FinancialEntity {
    id: ID!
    governmentId: String!
    name: String!
    address: String!

    hebrewName: String
    email: String
    website: String
    phoneNumber: String

    linkedEntities: [FinancialEntity!]!
  }

  " Financial entity, identifier by ID, represents an actual person "
  type PersonalFinancialEntity implements FinancialEntity {
    id: ID!
    name: String!
    email: String!

    linkedEntities: [FinancialEntity!]!
  }

  " represent a financial entity of any type that may hold financial accounts (company, business, individual) "
  interface FinancialEntity {
    id: ID!
    name: String!

    linkedEntities: [FinancialEntity!]!
  }

  extend interface Charge {
    " the financial entity that created the charge "
    owner: FinancialEntity!
  }

  extend type CommonCharge {
    owner: FinancialEntity!
  }

  extend type ConversionCharge {
    owner: FinancialEntity!
  }

  extend type SalaryCharge {
    owner: FinancialEntity!
  }

  extend type Mutation {
    updateBusiness(
      businessId: ID!
      ownerId: ID!
      fields: UpdateBusinessInput!
    ): UpdateBusinessResponse!
  }
  " result type for updateBusiness "
  union UpdateBusinessResponse = LtdFinancialEntity | CommonError

  " input for updateBusiness "
  input UpdateBusinessInput {
    name: String
    hebrewName: String
    address: String
    email: String
    website: String
    phoneNumber: String
    sortCode: Int
    governmentId: String
    taxCategory: UUID
  }
`;
