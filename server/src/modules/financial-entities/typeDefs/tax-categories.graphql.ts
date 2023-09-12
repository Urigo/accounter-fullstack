import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    taxCategories: [TaxCategory!]!
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

  " Tax category entity used for ledger records "
  type TaxCategory implements Counterparty {
    id: UUID!
    name: String!
  }
`;
