import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Mutation {
    updateChargeAccountantApproval(
      chargeId: UUID!
      approvalStatus: AccountantStatus!
    ): AccountantStatus! @auth(role: ACCOUNTANT)
    updateBusinessTripAccountantApproval(
      businessTripId: UUID!
      approvalStatus: AccountantStatus!
    ): AccountantStatus! @auth(role: ACCOUNTANT)
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
