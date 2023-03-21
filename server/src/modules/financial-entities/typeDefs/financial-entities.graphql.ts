import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    financialEntity(id: ID!): FinancialEntity!
    " TODO: This is temporary, should be replaced after auth and financial entities hierarchy is implemented "
    allFinancialEntities: [FinancialEntity!]!
  }

  " Financial entity, identifier by ID, can be a company or individual "
  type LtdFinancialEntity implements FinancialEntity {
    id: ID!
    governmentId: String!
    name: String!
    address: String!

    englishName: String
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

  extend type Charge {
    " the financial entity that created the charge "
    financialEntity: FinancialEntity!
  }
`;
