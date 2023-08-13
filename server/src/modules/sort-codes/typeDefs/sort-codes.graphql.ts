import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    allSortCodes: [SortCode!]!
  }

  " Sort Code "
  type SortCode {
    id: Int!
    name: String
  }

  extend type LtdFinancialEntity {
    sortCode: SortCode
  }

  extend type PersonalFinancialEntity {
    sortCode: SortCode
  }

  extend interface Counterparty {
    sortCode: SortCode
  }

  extend type NamedCounterparty {
    sortCode: SortCode
  }

  extend type TaxCategory {
    sortCode: SortCode
  }
`;
