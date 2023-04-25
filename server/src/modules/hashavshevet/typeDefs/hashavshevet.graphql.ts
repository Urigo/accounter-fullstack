import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
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
`;
