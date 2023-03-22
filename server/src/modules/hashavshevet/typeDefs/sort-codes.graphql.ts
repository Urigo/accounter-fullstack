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
    sortCode: SortCode!
    name: String
    businessID: UUID # TODO: (Gil) should be non-nullable
  }

  extend type BusinessTransactionSum {
    sortCode: SortCode
  }
`;
