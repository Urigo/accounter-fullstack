import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    updateLedgerRecord(
      ledgerRecordId: ID!
      fields: UpdateLedgerRecordInput!
    ): UpdateLedgerRecordResult!
    insertLedgerRecord(chargeId: ID!, record: InsertLedgerRecordInput!): InsertLedgerRecordResult!
    " TEMPORARY: to enable direct full update of the record "
    updateDbLedgerRecord(
      ledgerRecordId: ID!
      fields: UpdateDbLedgerRecordInput!
    ): UpdateLedgerRecordResult!
    " TEMPORARY: to enable direct full update of the record "
    insertDbLedgerRecord(
      chargeId: ID!
      record: InsertDbLedgerRecordInput!
    ): InsertLedgerRecordResult!
    generateLedgerRecords(chargeId: ID!): GenerateLedgerRecordsResult!
    deleteLedgerRecord(ledgerRecordId: ID!): Boolean!
  }

  " represent atomic movement of funds "
  type LedgerRecord {
    id: ID!
    originalAmount: FinancialAmount!
    date: TimelessDate!
    " Temporary. should be removed "
    valueDate: TimelessDate!
    " Temporary. should be removed "
    date3: TimelessDate!
    description: String!
    " in shekels at the moment"
    localCurrencyAmount: FinancialAmount!
  }

  extend type LedgerRecord {
    " TEMPORARY: extension to reflect original DB fields "
    # eslint-disable-next-line @graphql-eslint/naming-convention
    credit_account_1: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    credit_account_2: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    credit_amount_1: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    credit_amount_2: Float
    currency: Currency
    " date_3: String! "
    # eslint-disable-next-line @graphql-eslint/naming-convention
    debit_account_1: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    debit_account_2: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    debit_amount_1: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    debit_amount_2: Float
    details: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    foreign_credit_amount_1: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    foreign_credit_amount_2: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    foreign_debit_amount_1: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    foreign_debit_amount_2: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    hashavshevet_id: Int
    # eslint-disable-next-line @graphql-eslint/naming-convention
    invoice_date: TimelessDate!
    # eslint-disable-next-line @graphql-eslint/naming-convention
    movement_type: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    reference_1: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    reference_2: String
    reviewed: Boolean
    # eslint-disable-next-line @graphql-eslint/naming-convention
    value_date: TimelessDate!
  }

  " result type for generateLedgerRecords "
  union GenerateLedgerRecordsResult = Charge | CommonError # TODO: update to match more than common transaction
  " input variables for updateLedgerRecord "
  input UpdateLedgerRecordInput {
    originalAmount: FinancialAmountInput
    date: TimelessDate
    " Temporary. should be removed "
    valueDate: TimelessDate
    " Temporary. should be removed "
    date3: TimelessDate
    description: String
    " in shekels at the moment"
    localCurrencyAmount: FinancialAmountInput
  }

  " input variables for insertLedgerRecord "
  input InsertLedgerRecordInput {
    originalAmount: FinancialAmountInput
    date: TimelessDate #invoiceDate
    " Temporary. should be removed "
    valueDate: TimelessDate
    " Temporary. should be removed "
    date3: TimelessDate
    description: String
    " in shekels at the moment"
    localCurrencyAmount: FinancialAmountInput
  }

  " result type for insertLedgerRecord "
  union InsertLedgerRecordResult = Charge | CommonError

  " TEMPORARY: input variables for updateDbLedgerRecord "
  input UpdateDbLedgerRecordInput {
    # eslint-disable-next-line @graphql-eslint/naming-convention
    credit_account_1: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    credit_account_2: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    credit_amount_1: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    credit_amount_2: Float
    currency: Currency
    date3: TimelessDate
    # eslint-disable-next-line @graphql-eslint/naming-convention
    debit_account_1: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    debit_account_2: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    debit_amount_1: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    debit_amount_2: Float
    details: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    foreign_credit_amount_1: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    foreign_credit_amount_2: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    foreign_debit_amount_1: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    foreign_debit_amount_2: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    hashavshevet_id: Int
    # eslint-disable-next-line @graphql-eslint/naming-convention
    invoice_date: TimelessDate
    # eslint-disable-next-line @graphql-eslint/naming-convention
    movement_type: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    reference_1: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    reference_2: String
    reviewed: Boolean
    # eslint-disable-next-line @graphql-eslint/naming-convention
    value_date: TimelessDate
  }

  " TEMPORARY: input variables for insertDbLedgerRecord "
  input InsertDbLedgerRecordInput {
    # eslint-disable-next-line @graphql-eslint/naming-convention
    credit_account_1: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    credit_account_2: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    credit_amount_1: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    credit_amount_2: Float
    currency: Currency
    date3: TimelessDate!
    # eslint-disable-next-line @graphql-eslint/naming-convention
    debit_account_1: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    debit_account_2: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    debit_amount_1: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    debit_amount_2: Float
    details: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    foreign_credit_amount_1: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    foreign_credit_amount_2: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    foreign_debit_amount_1: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    foreign_debit_amount_2: Float
    # eslint-disable-next-line @graphql-eslint/naming-convention
    hashavshevet_id: Int
    # eslint-disable-next-line @graphql-eslint/naming-convention
    invoice_date: TimelessDate!
    # eslint-disable-next-line @graphql-eslint/naming-convention
    movement_type: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    reference_1: String
    # eslint-disable-next-line @graphql-eslint/naming-convention
    reference_2: String
    reviewed: Boolean
    # eslint-disable-next-line @graphql-eslint/naming-convention
    value_date: TimelessDate!
  }

  " result type for updateLedgerRecord "
  union UpdateLedgerRecordResult = LedgerRecord | CommonError

  extend type Charge {
    " ledger records linked to the charge "
    ledgerRecords: [LedgerRecord!]!
  }
`;
