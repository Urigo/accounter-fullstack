import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    accountantApprovalStatus(from: TimelessDate!, to: TimelessDate!): AccountantApprovalStatus!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " represents accountant approval status for a charge "
  type AccountantApprovalStatus {
    totalCharges: Int!
    approvedCount: Int!
    pendingCount: Int!
    unapprovedCount: Int!
  }

  extend type Mutation {
    updateChargeAccountantApproval(
      chargeId: UUID!
      approvalStatus: AccountantStatus!
    ): AccountantStatus! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateBusinessTripAccountantApproval(
      businessTripId: UUID!
      approvalStatus: AccountantStatus!
    ): AccountantStatus! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  extend interface Charge {
    " calculated based on ledger record and transaction approvals "
    accountantApproval: AccountantStatus!
  }

  extend type CommonCharge {
    accountantApproval: AccountantStatus!
  }

  extend type FinancialCharge {
    accountantApproval: AccountantStatus!
  }

  extend type ConversionCharge {
    accountantApproval: AccountantStatus!
  }

  extend type SalaryCharge {
    accountantApproval: AccountantStatus!
  }

  extend type InternalTransferCharge {
    accountantApproval: AccountantStatus!
  }

  extend type DividendCharge {
    accountantApproval: AccountantStatus!
  }

  extend type BusinessTripCharge {
    accountantApproval: AccountantStatus!
  }

  extend type MonthlyVatCharge {
    accountantApproval: AccountantStatus!
  }

  extend type BankDepositCharge {
    accountantApproval: AccountantStatus!
  }

  extend type ForeignSecuritiesCharge {
    accountantApproval: AccountantStatus!
  }

  extend type CreditcardBankCharge {
    accountantApproval: AccountantStatus!
  }

  extend input UpdateChargeInput {
    accountantApproval: AccountantStatus
  }

  extend type BusinessTrip {
    accountantApproval: AccountantStatus!
  }

  " represents accountant approval status "
  enum AccountantStatus {
    UNAPPROVED
    APPROVED
    PENDING
  }
`;
