import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    chargesWithLedgerChanges(filters: ChargeFilter, limit: Int): [ChargesWithLedgerChangesResult!]!
      @requiresAuth
    ledgerRecordsByDates(fromDate: TimelessDate!, toDate: TimelessDate!): [LedgerRecord!]!
      @requiresAuth
    ledgerRecordsByFinancialEntity(financialEntityId: UUID!): [LedgerRecord!]! @requiresAuth
    " search ledger records by a combination of date, financial entity, owner and charge filters "
    ledgerRecordsByFilters(filters: LedgerRecordsFilters): [LedgerRecord!]! @requiresAuth
  }

  extend type Mutation {
    " regenerate ledger records for one or more charges; returns a result per charge, in order "
    regenerateLedgerRecords(chargeIds: [UUID!]!): [GeneratedLedgerRecords!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    lockLedgerRecords(date: TimelessDate!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " the account slots a ledger record holds financial entities in "
  enum LedgerRecordAccount {
    DEBIT_ACCOUNT_1
    DEBIT_ACCOUNT_2
    CREDIT_ACCOUNT_1
    CREDIT_ACCOUNT_2
  }

  " filters for ledger records search "
  input LedgerRecordsFilters {
    " only records with invoice date on/after this date "
    fromInvoiceDate: TimelessDate
    " only records with invoice date on/before this date "
    toInvoiceDate: TimelessDate
    " only records with value date on/after this date "
    fromValueDate: TimelessDate
    " only records with value date on/before this date "
    toValueDate: TimelessDate
    " only records where the invoice date OR the value date is on/after this date "
    fromAnyDate: TimelessDate
    " only records where the invoice date OR the value date is on/before this date "
    toAnyDate: TimelessDate
    " only records referencing any of these financial entities "
    financialEntityIds: [UUID!]
    " which account slots financialEntityIds are matched against. defaults to all of them "
    financialEntityAccounts: [LedgerRecordAccount!]
    " only records owned by any of these businesses "
    ownerIds: [UUID!]
    " only records belonging to any of these charges "
    chargeIds: [UUID!]
    " cap the number of returned records. defaults to 10000 "
    limit: Int
  }

  " represent atomic movement of funds "
  type LedgerRecord {
    id: UUID!
    " the business owning the record "
    ownerId: UUID
    " the charge the record belongs to "
    chargeId: UUID!
    debitAmount1: FinancialAmount
    debitAmount2: FinancialAmount
    creditAmount1: FinancialAmount
    creditAmount2: FinancialAmount
    localCurrencyDebitAmount1: FinancialAmount!
    localCurrencyDebitAmount2: FinancialAmount
    localCurrencyCreditAmount1: FinancialAmount!
    localCurrencyCreditAmount2: FinancialAmount
    invoiceDate: DateTime!
    valueDate: DateTime!
    description: String
    reference: String
  }

  extend interface Charge {
    " ledger records linked to the charge "
    ledger: Ledger!
  }

  extend type CommonCharge {
    ledger: Ledger!
  }

  extend type FinancialCharge {
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

  extend type ForeignSecuritiesCharge {
    ledger: Ledger!
  }

  extend type CreditcardBankCharge {
    ledger: Ledger!
  }

  extend type ChargeMetadata {
    isLedgerLocked: Boolean!
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
