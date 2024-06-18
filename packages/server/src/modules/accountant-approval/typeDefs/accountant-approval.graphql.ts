import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Mutation {
    toggleChargeAccountantApproval(chargeId: UUID!, approved: Boolean!): Boolean!
      @auth(role: ACCOUNTANT)
  }

  extend interface Charge {
    " calculated based on ledger record and transaction approvals "
    accountantApproval: Boolean!
  }

  extend type CommonCharge {
    accountantApproval: Boolean!
  }

  extend type ConversionCharge {
    accountantApproval: Boolean!
  }

  extend type SalaryCharge {
    accountantApproval: Boolean!
  }

  extend type InternalTransferCharge {
    accountantApproval: Boolean!
  }

  extend type DividendCharge {
    accountantApproval: Boolean!
  }

  extend type BusinessTripCharge {
    accountantApproval: Boolean!
  }

  extend type MonthlyVatCharge {
    accountantApproval: Boolean!
  }

  extend type BankDepositCharge {
    accountantApproval: Boolean!
  }

  extend type CreditcardBankCharge {
    accountantApproval: Boolean!
  }

  extend input UpdateChargeInput {
    accountantApproval: Boolean
  }
`;
