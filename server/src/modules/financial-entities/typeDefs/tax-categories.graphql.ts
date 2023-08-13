import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    taxCategories: [TaxCategory!]!
  }

  extend type Charge {
    taxCategory: TaxCategory
  }

  " Tax category entity used for ledger records "
  type TaxCategory implements Counterparty {
    id: UUID!
    name: String!
  }
`;
