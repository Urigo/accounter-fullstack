import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    businessTransactionsSumFromLedgerRecords(
      filters: BusinessTransactionsFilter
    ): BusinessTransactionsSumFromLedgerRecordsResult! @auth(role: ACCOUNTANT)
    businessTransactionsFromLedgerRecords(
      filters: BusinessTransactionsFilter
    ): BusinessTransactionsFromLedgerRecordsResult! @auth(role: ACCOUNTANT)
  }

  " input variables for businessTransactions "
  input BusinessTransactionsFilter {
    businessIDs: [UUID!]
    ownerIds: [UUID!]
    type: FinancialEntityType
    fromDate: TimelessDate
    toDate: TimelessDate
    includeRevaluation: Boolean
  }

  " represent financial entity type "
  enum FinancialEntityType {
    BUSINESS
    TAX_CATEGORY
  }

  " result type for businessTransactionsSumFromLedgerRecords "
  union BusinessTransactionsSumFromLedgerRecordsResult =
    | BusinessTransactionsSumFromLedgerRecordsSuccessfulResult
    | CommonError

  " result type for businessTransactionsSumFromLedgerRecords" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type BusinessTransactionsSumFromLedgerRecordsSuccessfulResult {
    businessTransactionsSum: [BusinessTransactionSum!]!
  }

  " single business transaction summery " # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type BusinessTransactionSum {
    business: FinancialEntity!
    credit: FinancialAmount!
    debit: FinancialAmount!
    total: FinancialAmount!
    foreignCurrenciesSum: [ForeignCurrencySum!]!
  }

  " summary of foreign currency business transactions " # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type ForeignCurrencySum {
    credit: FinancialAmount!
    debit: FinancialAmount!
    total: FinancialAmount!
    currency: Currency!
  }

  " result type for businessTransactionsFromLedgerRecords "
  union BusinessTransactionsFromLedgerRecordsResult =
    | BusinessTransactionsFromLedgerRecordsSuccessfulResult
    | CommonError

  " result type for businessTransactionsFromLedgerRecords" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type BusinessTransactionsFromLedgerRecordsSuccessfulResult {
    businessTransactions: [BusinessTransaction!]!
  }

  " single business transaction info " # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type BusinessTransaction {
    amount: FinancialAmount!
    business: FinancialEntity!
    foreignAmount: FinancialAmount
    invoiceDate: TimelessDate!
    reference1: String
    reference2: String
    details: String
    counterAccount: FinancialEntity
    chargeId: UUID!
  }
`;
