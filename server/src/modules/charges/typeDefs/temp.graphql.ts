import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend interface Charge {
    " temp old ledger data "
    oldLedger: [OldLedger!]!
  }

  extend type CommonCharge {
    oldLedger: [OldLedger!]!
  }

  extend type ConversionCharge {
    oldLedger: [OldLedger!]!
  }

  extend type SalaryCharge {
    oldLedger: [OldLedger!]!
  }

  extend type InternalTransferCharge {
    oldLedger: [OldLedger!]!
  }

  extend type DividendCharge {
    oldLedger: [OldLedger!]!
  }

  extend type BusinessTripCharge {
    oldLedger: [OldLedger!]!
  }

  " Old ledger entity"
  type OldLedger {
    business: String!
    " chargeId: string; "
    creditAccount1: String
    creditAccount2: String
    creditAccountId1: String
    creditAccountId2: String
    creditAmount1: String
    creditAmount2: String
    currency: String
    date3: String!
    debitAccount1: String
    debitAccount2: String
    debitAccountId1: String
    debitAccountId2: String
    debitAmount1: String
    debitAmount2: String
    details: String
    foreignCreditAmount1: String
    foreignCreditAmount2: String
    foreignDebitAmount1: String
    foreignDebitAmount2: String
    hashavshevetId: Int
    id: UUID!
    invoiceDate: String!
    movementType: String
    origin: String!
    originalId: String
    proformaInvoiceFile: String
    reference1: String
    reference2: String
    reviewed: Boolean
    valueDate: String!
  }
`;
