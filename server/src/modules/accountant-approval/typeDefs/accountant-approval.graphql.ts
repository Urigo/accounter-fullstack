import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Mutation {
    toggleChargeAccountantApproval(chargeId: ID!, approved: Boolean!): Boolean!
    toggleLedgerRecordAccountantApproval(ledgerRecordId: ID!, approved: Boolean!): Boolean!
  }

  " info regarding the accountant approval process "
  type AccountantApproval {
    approved: Boolean!
    remark: String
  }

  " input variables for updateCharge.AccountantApproval"
  input AccountantApprovalInput {
    approved: Boolean!
    remark: String
  }

  extend type LedgerRecord {
    accountantApproval: AccountantApproval!
  }

  extend type Charge {
    " calculated based on ledger record and transaction approvals "
    accountantApproval: AccountantApproval!
  }

  extend input UpdateChargeInput {
    accountantApproval: AccountantApprovalInput
  }

  extend input UpdateLedgerRecordInput {
    accountantApproval: AccountantApprovalInput
  }

  extend input InsertLedgerRecordInput {
    accountantApproval: AccountantApprovalInput
  }
`;
