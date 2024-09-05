import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    depreciationCategories: [DepreciationCategory!]!
    depreciationRecordsByCharge(chargeId: UUID!): [DepreciationRecord!]!
  }

  extend type CommonCharge {
    " depreciation records "
    depreciationRecords: [DepreciationRecord!]!
  }

  " represent a depreciation record for a charge"
  type DepreciationRecord {
    id: UUID!
    chargeId: UUID!
    charge: Charge!
    amount: FinancialAmount!
    activationDate: TimelessDate!
    category: DepreciationCategory!
    type: DepreciationType
  }

  " represent a category of depreciation "
  type DepreciationCategory {
    id: UUID!
    name: String!
    percentage: Float!
  }

  extend type Mutation {
    updateDepreciationRecord(
      input: UpdateDepreciationRecordInput!
    ): UpdateDepreciationRecordResult! @auth(role: ACCOUNTANT)
    insertDepreciationRecord(
      input: InsertDepreciationRecordInput!
    ): InsertDepreciationRecordResult! @auth(role: ACCOUNTANT)
    deleteDepreciationRecord(depreciationRecordId: UUID!): Boolean! @auth(role: ACCOUNTANT)
    deleteDepreciationRecordsByCharge(chargeId: UUID!): Boolean! @auth(role: ACCOUNTANT)
    updateDepreciationCategory(
      input: UpdateDepreciationCategoryInput!
    ): UpdateDepreciationCategoryResult! @auth(role: ACCOUNTANT)
    insertDepreciationCategory(
      input: InsertDepreciationCategoryInput!
    ): InsertDepreciationCategoryResult! @auth(role: ACCOUNTANT)
    deleteDepreciationCategory(depreciationCategoryId: UUID!): Boolean! @auth(role: ACCOUNTANT)
  }

  " depreciation type "
  enum DepreciationType {
    GENERAL_AND_MANAGEMENT
    MARKETING
    RESEARCH_AND_DEVELOPMENT
  }

  " input variables for insertDepreciationRecord "
  input InsertDepreciationRecordInput {
    chargeId: UUID!
    amount: Float
    currency: Currency
    activationDate: TimelessDate!
    type: DepreciationType
    categoryId: UUID!
  }

  " result type for insertDepreciationRecord "
  union InsertDepreciationRecordResult = DepreciationRecord | CommonError

  " input variables for updateDepreciationRecord "
  input UpdateDepreciationRecordInput {
    id: UUID!
    chargeId: UUID
    amount: Float
    currency: Currency
    activationDate: TimelessDate
    type: DepreciationType
    categoryId: UUID
  }

  " result type for updateDepreciationRecord "
  union UpdateDepreciationRecordResult = DepreciationRecord | CommonError

  " input variables for insertDepreciationCategory "
  input InsertDepreciationCategoryInput {
    name: String!
    percentage: Float!
  }

  " result type for insertDepreciationCategory "
  union InsertDepreciationCategoryResult = DepreciationCategory | CommonError

  " input variables for updateDepreciationCategory "
  input UpdateDepreciationCategoryInput {
    id: UUID!
    name: String
    percentage: Float
  }

  " result type for updateDepreciationCategory "
  union UpdateDepreciationCategoryResult = DepreciationCategory | CommonError
`;
