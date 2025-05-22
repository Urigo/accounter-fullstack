import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    allSortCodes: [SortCode!]! @auth(role: ACCOUNTANT)
    sortCode(key: Int!): SortCode @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    addSortCode(name: String!, key: Int!, defaultIrsCode: Int): Boolean! @auth(role: ACCOUNTANT)
    updateSortCode(key: Int!, fields: UpdateSortCodeFieldsInput!): Boolean! @auth(role: ACCOUNTANT)
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
