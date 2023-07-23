import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    transactionsByIDs(transactionIDs: [ID!]!): [Transaction!]!
  }

  extend type Mutation {
    updateTransaction(transactionId: ID!, fields: UpdateTransactionInput!): UpdateTransactionResult!
  }

  extend type Charge {
    " list of financial/bank transactions linked to the charge "
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
    from: Currency!
    to: Currency!
    " המרה של הבנק "
    bankRate: Rate!
    " בנק ישראל "
    officialRate: Rate
    createdOn: Date!
    updatedOn: Date!
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
  }

  " result type for updateTransaction "
  union UpdateTransactionResult = CommonTransaction | CommonError # TODO: update to match more than common transaction
`;
