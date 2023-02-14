import { gql } from 'graphql-modules';

export default gql`
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

  extend input UpdateTransactionInput {
    hashavshevetId: Int
  }

  extend input UpdateLedgerRecordInput {
    hashavshevetId: Int
  }

  extend input InsertLedgerRecordInput {
    hashavshevetId: Int
  }
`;
