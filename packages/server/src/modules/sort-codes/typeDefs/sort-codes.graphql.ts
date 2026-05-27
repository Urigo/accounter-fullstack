import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    allSortCodes: [SortCode!]! @requiresAuth
    allSortCodesByBusiness(ownerId: String!): [SortCode!]! @requiresAuth
    sortCode(key: Int!, ownerId: String!): SortCode @requiresAuth
  }

  extend type Mutation {
    addSortCode(name: String!, key: Int!, defaultIrsCode: Int): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateSortCode(key: Int!, fields: UpdateSortCodeFieldsInput!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " input variables for updateSortCode "
  input UpdateSortCodeFieldsInput {
    name: String
    defaultIrsCode: Int
  }

  " Sort Code "
  type SortCode {
    id: ID!
    key: Int!
    ownerId: UUID!
    name: String
    defaultIrsCode: Int
  }

  extend type LtdFinancialEntity {
    sortCode: SortCode
  }

  extend type PersonalFinancialEntity {
    sortCode: SortCode
  }

  extend interface FinancialEntity {
    sortCode: SortCode
  }

  extend interface Business {
    sortCode: SortCode
  }

  extend type TaxCategory {
    sortCode: SortCode
  }
`;
