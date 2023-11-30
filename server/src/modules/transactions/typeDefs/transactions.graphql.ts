import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    transactionsByIDs(transactionIDs: [ID!]!): [Transaction!]!
  }

  extend type Mutation {
    updateTransaction(transactionId: ID!, fields: UpdateTransactionInput!): UpdateTransactionResult!
  }

  extend interface Charge {
    " list of financial/bank transactions linked to the charge "
    transactions: [Transaction!]!
  }

  extend type CommonCharge {
    transactions: [Transaction!]!
  }

  extend type ConversionCharge {
    transactions: [Transaction!]!
  }

  extend type SalaryCharge {
    transactions: [Transaction!]!
  }

  extend type InternalTransferCharge {
    transactions: [Transaction!]!
  }

  extend type DividendCharge {
    transactions: [Transaction!]!
  }

  extend type BusinessTripCharge {
    transactions: [Transaction!]!
  }

  " Represent a general transaction object "
  interface Transaction {
    id: ID!
    " external key / identifier in the bank or card (אסמכתא) "
    referenceNumber: String!
    " eventDate "
    eventDate: TimelessDate!
    " debitDate "
    effectiveDate: TimelessDate # TODO: this should be required, but lots are missing in the DB
    " either credit or debit "
    direction: TransactionDirection!
    " the amount of the transaction "
    amount: FinancialAmount!
    " description of the transaction, as defined by the bank/card "
    sourceDescription: String!
    " effective bank / card balance, after the transaction "
    balance: FinancialAmount!
    " when the initial transaction was created from the first event we found "
    createdOn: Date!
    " when the transaction was last updated "
    updatedOn: Date!
  }

  " The direction of the transaction "
  enum TransactionDirection {
    DEBIT
    CREDIT
  }

  " temp type until DB  supports transactions differenciation"
  type CommonTransaction implements Transaction {
    id: ID!
    referenceNumber: String!
    eventDate: TimelessDate!
    effectiveDate: TimelessDate # TODO: this should be required, but lots are missing in the DB
    direction: TransactionDirection!
    amount: FinancialAmount!
    sourceDescription: String!
    balance: FinancialAmount!
    createdOn: Date!
    updatedOn: Date!
  }

  " העברה "
  type WireTransaction implements Transaction {
    id: ID!
    referenceNumber: String!
    eventDate: TimelessDate!
    effectiveDate: TimelessDate!
    direction: TransactionDirection!
    amount: FinancialAmount!
    sourceDescription: String!
    balance: FinancialAmount!
    createdOn: Date!
    updatedOn: Date!
  }

  " עמלה "
  type FeeTransaction implements Transaction {
    id: ID!
    referenceNumber: String!
    eventDate: TimelessDate!
    effectiveDate: TimelessDate!
    direction: TransactionDirection!
    amount: FinancialAmount!
    sourceDescription: String!
    balance: FinancialAmount!
    createdOn: Date!
    updatedOn: Date!
  }

  " המרה "
  type ConversionTransaction implements Transaction {
    id: ID!
    referenceNumber: String!
    eventDate: TimelessDate!
    effectiveDate: TimelessDate!
    direction: TransactionDirection!
    amount: FinancialAmount!
    sourceDescription: String!
    balance: FinancialAmount!
    type: ConversionTransactionType!
    " המרה של הבנק "
    bankRate: Rate!
    " בנק ישראל "
    officialRateToLocal: Rate
    createdOn: Date!
    updatedOn: Date!
  }

  " Type pf conversion transaction "
  enum ConversionTransactionType {
    " קניה "
    QUOTE
    " מכירה "
    BASE
  }

  " input variables for updateTransaction "
  input UpdateTransactionInput {
    eventDate: TimelessDate
    effectiveDate: TimelessDate
    amount: FinancialAmountInput
    sourceDescription: String
    accountId: UUID
    balance: FinancialAmountInput
    counterpartyId: UUID
    chargeId: ID
  }

  " result type for updateTransaction "
  union UpdateTransactionResult = CommonTransaction | ConversionTransaction | CommonError # TODO: update to match more than common transaction
`;
