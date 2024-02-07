import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    allSortCodes: [SortCode!]! @auth(role: ACCOUNTANT)
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
