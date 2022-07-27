import { gql } from 'graphql-modules';

export const accountantSchema = gql`
  extend type LedgerRecord {
    accountantApproval: AccountantApproval!
  }

  extend interface Transaction {
    accountantApproval: AccountantApproval!
  }

  extend type Charge {
    accountantApproval: AccountantApproval! # calculated based on ledger record and transaction approvals
  }

  " info regarding the accountant approval process "
  type AccountantApproval {
    approved: Boolean!
    remark: String
  }

  extend input UpdateTransactionInput {
    accountantApproval: AccountantApprovalInput
  }

  " input variables for updateCharge.AccountantApproval"
  input AccountantApprovalInput {
    approved: Boolean!
    remark: String
  }

  extend type CommonTransaction {
    accountantApproval: AccountantApproval!
  }

  extend type WireTransaction {
    accountantApproval: AccountantApproval!
  }

  extend type FeeTransaction {
    accountantApproval: AccountantApproval!
  }

  extend type ConversionTransaction {
    accountantApproval: AccountantApproval!
  }
`;
