import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Mutation {
    mergeChargesByTransactionReference: MergeChargesByTransactionReferenceResult!
    flagForeignFeeTransactions: FlagForeignFeeTransactionsResult!
  }

  type MergeChargesByTransactionReferenceResult {
    success: Boolean!
    charges: [Charge!]
    errors: [String!]
  }

  type FlagForeignFeeTransactionsResult {
    success: Boolean!
    transactions: [Transaction!]
    errors: [String!]
  }
`;
