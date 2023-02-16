import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    allSortCodes: [SortCode!]!
  }

  " Hashavshevet sort code "
  type SortCode {
    id: Int!
    name: String
    accounts: [HashavshevetAccount!]!
  }

  " Hashavshevet account "
  type HashavshevetAccount {
    id: ID!
    key: String!
    sortCode: SortCode!
    name: String
  }

  extend type BusinessTransactionSum {
    sortCode: SortCode
  }
`;
