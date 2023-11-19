import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    taxCategories: [TaxCategory!]!
    taxCategoryByBusinessId(businessId: ID!, ownerId: ID!): TaxCategory # TODO: get owner from server context
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

  extend type LtdFinancialEntity {
    taxCategory: TaxCategory
  }

  " Tax category entity used for ledger records "
  type TaxCategory implements Counterparty {
    id: UUID!
    name: String!
  }
`;
