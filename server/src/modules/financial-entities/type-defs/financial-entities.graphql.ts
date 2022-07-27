import { gql } from 'graphql-modules';

export const financialEntitiesSchema = gql`
  extend type Query {
    financialEntity(id: ID!): FinancialEntity!
  }

  " Financial entity, identifier by ID, can be a company or individual "
  type LtdFinancialEntity implements FinancialEntity {
    id: ID!
    govermentId: String!
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

    linkedEntities: [FinancialEntity!]!
  }
`;
