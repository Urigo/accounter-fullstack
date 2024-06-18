import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    chargesWithLedgerChanges(filters: ChargeFilter, limit: Int): [ChargesWithLedgerChangesResult!]!
      @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    regenerateLedgerRecords(chargeId: UUID!): GeneratedLedgerRecords! @auth(role: ACCOUNTANT)
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
  }

  extend type CommonCharge {
    ledger: Ledger!
  }

  extend type ConversionCharge {
    ledger: Ledger!
  }

  extend type SalaryCharge {
    ledger: Ledger!
  }

  extend type InternalTransferCharge {
    ledger: Ledger!
  }

  extend type DividendCharge {
    ledger: Ledger!
  }

  extend type BusinessTripCharge {
    ledger: Ledger!
  }

  extend type MonthlyVatCharge {
    ledger: Ledger!
  }

  extend type BankDepositCharge {
    ledger: Ledger!
  }

  extend type CreditcardBankCharge {
    ledger: Ledger!
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
    validate(shouldInsertLedgerInNew: Boolean): LedgerValidation!
  }

  " ledger validation info"
  type LedgerValidation {
    isValid: Boolean!
    matches: [UUID!]!
    differences: [LedgerRecord!]!
    errors: [String!]!
  }

  " result type for ledger records "
  union GeneratedLedgerRecords = Ledger | CommonError

  " result type for charges with ledger changes "
  type ChargesWithLedgerChangesResult {
    progress: Float!
    charge: Charge
  }
`;
