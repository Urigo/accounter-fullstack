import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    " validate if generated ledger has any differences from stored ledger "
    validateLedgerByChargeId(chargeId: UUID!): Boolean!
  }

  " represent atomic movement of funds "
  type LedgerRecord {
    id: UUID!
    debitAmount1: FinancialAmount
    debitAmount2: FinancialAmount
    creditAmount1: FinancialAmount
    creditAmount2: FinancialAmount
    localCurrencyDebitAmount1: FinancialAmount!
    localCurrencyDebitAmount2: FinancialAmount
    localCurrencyCreditAmount1: FinancialAmount!
    localCurrencyCreditAmount2: FinancialAmount
    invoiceDate: Date!
    valueDate: Date!
    description: String
    reference1: String
  }

  extend interface Charge {
    " ledger records linked to the charge "
    ledger: Ledger!
    generatedLedgerRecords: GeneratedLedgerRecords
  }

  extend type CommonCharge {
    ledger: Ledger!
    generatedLedgerRecords: GeneratedLedgerRecords
  }

  extend type ConversionCharge {
    ledger: Ledger!
    generatedLedgerRecords: GeneratedLedgerRecords
  }

  extend type SalaryCharge {
    ledger: Ledger!
    generatedLedgerRecords: GeneratedLedgerRecords
  }

  extend type InternalTransferCharge {
    ledger: Ledger!
    generatedLedgerRecords: GeneratedLedgerRecords
  }

  extend type DividendCharge {
    ledger: Ledger!
    generatedLedgerRecords: GeneratedLedgerRecords
  }

  extend type BusinessTripCharge {
    ledger: Ledger!
    generatedLedgerRecords: GeneratedLedgerRecords
  }

  extend type MonthlyVatCharge {
    ledger: Ledger!
    generatedLedgerRecords: GeneratedLedgerRecords
  }

  " unbalanced entity over ledger records "
  type LedgerBalanceUnbalancedEntity {
    entity: FinancialEntity!
    balance: FinancialAmount!
  }

  " info about ledger total balance "
  type LedgerBalanceInfo {
    isBalanced: Boolean!
    unbalancedEntities: [LedgerBalanceUnbalancedEntity!]!
  }

  " array of ledger records linked to the charge "
  type Ledger {
    records: [LedgerRecord!]!
    balance: LedgerBalanceInfo
    validate: LedgerValidation!
  }

  " ledger validation info"
  type LedgerValidation {
    isValid: Boolean!
    matches: [UUID!]!
    differences: [LedgerRecord!]!
  }

  " result type for ledger records "
  union GeneratedLedgerRecords = Ledger | CommonError
`;
