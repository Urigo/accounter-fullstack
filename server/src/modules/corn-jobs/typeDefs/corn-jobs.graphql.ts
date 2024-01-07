import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Mutation {
    mergeChargesByTransactionReference: MergeChargesByTransactionReferenceResult!
    flagForeignFeeTransactions: FlagForeignFeeTransactionsResult!
  }

  " result type for mergeChargesByTransactionReference "
  type MergeChargesByTransactionReferenceResult {
    success: Boolean!
    charges: [Charge!]
    errors: [String!]
  }

  " result type for flagForeignFeeTransactions "
  type FlagForeignFeeTransactionsResult {
    success: Boolean!
    transactions: [Transaction!]
    errors: [String!]
  }
`;
