import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    depreciationCategories: [DepreciationCategory!]!
    depreciationRecordsByCharge(chargeId: UUID!): [DepreciationRecord!]! @requiresAuth
  }

  extend type CommonCharge {
    " depreciation records "
    depreciationRecords: [DepreciationRecord!]!
  }

  extend type ChargeMetadata {
    depreciationRecordsCount: Int!
  }

  " represent a depreciation record for a charge"
  type DepreciationRecord {
    id: UUID!
    chargeId: UUID!
    charge: Charge!
    " the asset's cost, in the currency it was paid in "
    amount: FinancialAmount!
    " the asset's cost basis in the local currency: the override when set, else the amount converted at the purchase date's rate. Null when the record has no amount "
    localAmount: FinancialAmount
    " the local cost basis override, if set "
    localAmountOverride: Float
    " the asset's own cost account, if set; otherwise the asset account is the tax category of the charge that bought it "
    assetTaxCategory: TaxCategory
    " the rate the amount was converted at; null for local-currency records and overrides "
    exchangeRate: Float
    " the date of the rate the amount was converted at; null for local-currency records and overrides "
    exchangeRateDate: TimelessDate
    activationDate: TimelessDate!
    category: DepreciationCategory!
    type: DepreciationType
  }

  " represent a category of depreciation "
  type DepreciationCategory {
    id: UUID!
    name: String!
    " annual rate in percent; 0 for a category that is not depreciated "
    percentage: Float!
  }

  extend type Mutation {
    updateDepreciationRecord(
      input: UpdateDepreciationRecordInput!
    ): UpdateDepreciationRecordResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    insertDepreciationRecord(
      input: InsertDepreciationRecordInput!
    ): InsertDepreciationRecordResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    deleteDepreciationRecord(depreciationRecordId: UUID!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateDepreciationCategory(
      input: UpdateDepreciationCategoryInput!
    ): UpdateDepreciationCategoryResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    insertDepreciationCategory(
      input: InsertDepreciationCategoryInput!
    ): InsertDepreciationCategoryResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    deleteDepreciationCategory(depreciationCategoryId: UUID!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
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
    " cost basis override in the local currency, for an asset paid for in a foreign currency "
    localAmount: Float
    " the asset's cost account; defaults to the tax category of the charge that bought it. Set it when one charge buys several assets "
    assetTaxCategoryId: UUID
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
    " cost basis override in the local currency; null clears it, leaving it out keeps it "
    localAmount: Float
    " the asset's cost account; null clears it (back to the charge's tax category), leaving it out keeps it "
    assetTaxCategoryId: UUID
    activationDate: TimelessDate
    type: DepreciationType
    categoryId: UUID
  }

  " result type for updateDepreciationRecord "
  union UpdateDepreciationRecordResult = DepreciationRecord | CommonError

  " input variables for insertDepreciationCategory "
  input InsertDepreciationCategoryInput {
    name: String!
    " annual rate in percent, 0 to 100; 0 for a category that is not depreciated "
    percentage: Float!
  }

  " result type for insertDepreciationCategory "
  union InsertDepreciationCategoryResult = DepreciationCategory | CommonError

  " input variables for updateDepreciationCategory "
  input UpdateDepreciationCategoryInput {
    id: UUID!
    name: String
    " annual rate in percent, 0 to 100; 0 for a category that is not depreciated "
    percentage: Float
  }

  " result type for updateDepreciationCategory "
  union UpdateDepreciationCategoryResult = DepreciationCategory | CommonError
`;
