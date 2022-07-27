import { gql } from 'graphql-modules';

export const hashavshevetSchema = gql`
  extend type LedgerRecord {
    hashavshevetId: Int
  }

  extend interface Transaction {
    hashavshevetId: Int
  }

  extend type CommonTransaction {
    hashavshevetId: Int
  }

  extend type WireTransaction {
    hashavshevetId: Int
  }

  extend type FeeTransaction {
    hashavshevetId: Int
  }

  extend type ConversionTransaction {
    hashavshevetId: Int
  }
`;
