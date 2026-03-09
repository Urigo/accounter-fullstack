import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    taxCategories: [TaxCategory!]! @requiresAuth
    taxCategory(id: UUID!): TaxCategory! @requiresAuth
    taxCategoryByBusinessId(businessId: UUID!): TaxCategory @requiresAuth
  }

  extend interface Charge {
    taxCategory: TaxCategory
  }

  extend type CommonCharge {
    taxCategory: TaxCategory
  }

  extend type FinancialCharge {
    taxCategory: TaxCategory
  }

  extend type ConversionCharge {
    taxCategory: TaxCategory
  }

  extend type SalaryCharge {
    taxCategory: TaxCategory
  }

  extend type InternalTransferCharge {
    taxCategory: TaxCategory
  }

  extend type DividendCharge {
    taxCategory: TaxCategory
  }

  extend type BusinessTripCharge {
    taxCategory: TaxCategory
  }

  extend type MonthlyVatCharge {
    taxCategory: TaxCategory
  }

  extend type LtdFinancialEntity {
    taxCategory: TaxCategory
  }

  extend type BankDepositCharge {
    taxCategory: TaxCategory
  }

  extend type ForeignSecuritiesCharge {
    taxCategory: TaxCategory
  }

  extend type CreditcardBankCharge {
    taxCategory: TaxCategory
  }

  " Tax category entity used for ledger records "
  type TaxCategory implements FinancialEntity {
    id: UUID!
    name: String!
    irsCode: Int
    createdAt: DateTime!
    updatedAt: DateTime!
    isActive: Boolean!
  }

  extend type Mutation {
    updateTaxCategory(
      taxCategoryId: UUID!
      fields: UpdateTaxCategoryInput!
    ): UpdateTaxCategoryResponse!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    insertTaxCategory(fields: InsertTaxCategoryInput!): TaxCategory!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " result type for updateBusiness "
  union UpdateTaxCategoryResponse = TaxCategory | CommonError

  " input for updateTaxCategory "
  input UpdateTaxCategoryInput {
    name: String
    sortCode: Int
    irsCode: Int
    isActive: Boolean

    hashavshevetName: String
    taxExcluded: Boolean
  }

  " input for insertTaxCategory "
  input InsertTaxCategoryInput {
    name: String!
    sortCode: Int
    irsCode: Int
    hashavshevetName: String
    taxExcluded: Boolean
    isActive: Boolean
  }
`;
