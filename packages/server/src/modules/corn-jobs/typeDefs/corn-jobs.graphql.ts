import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    mergeChargesByTransactionReference: MergeChargesByTransactionReferenceResult!
      @requiresAuth
      @requiresRole(role: "business_owner")
    flagForeignFeeTransactions: FlagForeignFeeTransactionsResult!
      @requiresAuth
      @requiresRole(role: "business_owner")
    calculateCreditcardTransactionsDebitDate: Boolean!
      @requiresAuth
      @requiresRole(role: "business_owner")
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
