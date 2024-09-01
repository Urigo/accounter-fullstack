import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    deprecationCategories: [DeprecationCategory!]!
    deprecationRecordsByCharge(chargeId: UUID!): [DeprecationRecord!]!
  }

  extend type CommonCharge {
    " deprecation records "
    deprecationRecords: [DeprecationRecord!]!
  }

  " represent a deprecation record for a charge"
  type DeprecationRecord {
    id: UUID!
    chargeId: UUID!
    charge: Charge!
    amount: FinancialAmount!
    activationDate: TimelessDate!
    category: DeprecationCategory!
    type: DeprecationType
  }

  " represent a category of deprecation "
  type DeprecationCategory {
    id: UUID!
    name: String!
    percentage: Float!
  }

  extend type Mutation {
    updateDeprecationRecord(input: UpdateDeprecationRecordInput!): UpdateDeprecationRecordResult!
      @auth(role: ACCOUNTANT)
    insertDeprecationRecord(input: InsertDeprecationRecordInput!): InsertDeprecationRecordResult!
      @auth(role: ACCOUNTANT)
    deleteDeprecationRecord(deprecationRecordId: UUID!): Boolean! @auth(role: ACCOUNTANT)
    deleteDeprecationRecordsByCharge(chargeId: UUID!): Boolean! @auth(role: ACCOUNTANT)
    updateDeprecationCategory(
      input: UpdateDeprecationCategoryInput!
    ): UpdateDeprecationCategoryResult! @auth(role: ACCOUNTANT)
    insertDeprecationCategory(
      input: InsertDeprecationCategoryInput!
    ): InsertDeprecationCategoryResult! @auth(role: ACCOUNTANT)
    deleteDeprecationCategory(deprecationCategoryId: UUID!): Boolean! @auth(role: ACCOUNTANT)
  }

  " deprecation type "
  enum DeprecationType {
    GENERAL_AND_MANAGEMENT
    MARKETING
    RESEARCH_AND_DEVELOPMENT
  }

  " input variables for insertDeprecationRecord "
  input InsertDeprecationRecordInput {
    chargeId: UUID!
    amount: Float
    currency: Currency
    activationDate: TimelessDate!
    type: DeprecationType
    categoryId: UUID!
  }

  " result type for insertDeprecationRecord "
  union InsertDeprecationRecordResult = DeprecationRecord | CommonError

  " input variables for updateDeprecationRecord "
  input UpdateDeprecationRecordInput {
    id: UUID!
    chargeId: UUID
    amount: Float
    currency: Currency
    activationDate: TimelessDate
    type: DeprecationType
    categoryId: UUID
  }

  " result type for updateDeprecationRecord "
  union UpdateDeprecationRecordResult = DeprecationRecord | CommonError

  " input variables for insertDeprecationCategory "
  input InsertDeprecationCategoryInput {
    name: String!
    percentage: Float!
  }

  " result type for insertDeprecationCategory "
  union InsertDeprecationCategoryResult = DeprecationCategory | CommonError

  " input variables for updateDeprecationCategory "
  input UpdateDeprecationCategoryInput {
    id: UUID!
    name: String
    percentage: Float
  }

  " result type for updateDeprecationCategory "
  union UpdateDeprecationCategoryResult = DeprecationCategory | CommonError
`;
