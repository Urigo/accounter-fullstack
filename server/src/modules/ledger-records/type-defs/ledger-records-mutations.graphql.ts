import { gql } from 'graphql-modules';

export const ledgerRecordsMutationsSchema = gql`
  extend type Mutation {
    updateLedgerRecord(ledgerRecordId: ID!, fields: UpdateLedgerRecordInput!): UpdateLedgerRecordResult!
    insertLedgerRecord(chargeId: ID!, record: InsertLedgerRecordInput!): InsertLedgerRecordResult!
    generateLedgerRecords(chargeId: ID!): GenerateLedgerRecordsResult!
  }

  " input variables for updateLedgerRecord "
  input UpdateLedgerRecordInput {
    creditAccount: CounterpartyInput
    debitAccount: CounterpartyInput
    originalAmount: FinancialAmountInput
    date: TimelessDate
    description: String
    accountantApproval: AccountantApprovalInput
    " in shekels at the moment"
    localCurrencyAmount: FinancialAmountInput
    hashavshevetId: Int
  }

  " input variables for insertLedgerRecord "
  input InsertLedgerRecordInput {
    creditAccount: CounterpartyInput
    debitAccount: CounterpartyInput
    originalAmount: FinancialAmountInput
    date: TimelessDate #invoiceDate
    description: String
    accountantApproval: AccountantApprovalInput
    " in shekels at the moment"
    localCurrencyAmount: FinancialAmountInput
    hashavshevetId: Int
    valueDate: TimelessDate
    date3: TimelessDate #TODO: better naming
  }

  " result type for generateLedgerRecords "
  union GenerateLedgerRecordsResult = Charge | CommonError # TODO: update to match more than common transaction
  " result type for updateLedgerRecord "
  union UpdateLedgerRecordResult = LedgerRecord | CommonError

  " result type for insertLedgerRecord "
  union InsertLedgerRecordResult = Charge | CommonError
`;
