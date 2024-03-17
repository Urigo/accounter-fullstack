import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    taxCategories: [TaxCategory!]! @auth(role: ACCOUNTANT)
    taxCategoryByBusinessId(businessId: UUID!, ownerId: UUID!): TaxCategory @auth(role: ACCOUNTANT) # TODO: get owner from server context
  }

  extend interface Charge {
    taxCategory: TaxCategory
  }

  extend type CommonCharge {
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

  " Tax category entity used for ledger records "
  type TaxCategory implements FinancialEntity {
    id: UUID!
    name: String!
  }

  extend type Mutation {
    updateTaxCategory(
      taxCategoryId: UUID!
      ownerId: UUID!
      fields: UpdateTaxCategoryInput!
    ): UpdateTaxCategoryResponse! @auth(role: ACCOUNTANT)
  }

  " result type for updateBusiness "
  union UpdateTaxCategoryResponse = TaxCategory | CommonError

  " input for updateTaxCategory "
  input UpdateTaxCategoryInput {
    name: String
    sortCode: Int

    hashavshevetName: String
  }
`;
