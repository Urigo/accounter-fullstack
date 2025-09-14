import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    mergeChargesByTransactionReference: MergeChargesByTransactionReferenceResult! @auth(role: ADMIN)
    flagForeignFeeTransactions: FlagForeignFeeTransactionsResult! @auth(role: ADMIN)
    calculateCreditcardTransactionsDebitDate: Boolean! @auth(role: ADMIN)
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
