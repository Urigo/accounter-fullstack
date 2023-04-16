import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  " mutation root "
  type Mutation {
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
    createdAt: Date!
    " debitDate "
    effectiveDate: TimelessDate # TODO: this should be required, but lots are missing in the DB
    " either credit or debit "
    direction: TransactionDirection!
    " the amount of the transaction "
    amount: FinancialAmount!
    " description of the transaction, as defined by the bank/card "
    description: String!
    " effective bank / card balance, after the transaction "
    balance: FinancialAmount!
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
    createdAt: Date!
    effectiveDate: TimelessDate # TODO: this should be required, but lots are missing in the DB
    direction: TransactionDirection!
    amount: FinancialAmount!
    description: String!
    balance: FinancialAmount!
  }

  " העברה "
  type WireTransaction implements Transaction {
    id: ID!
    referenceNumber: String!
    createdAt: Date!
    effectiveDate: TimelessDate!
    direction: TransactionDirection!
    amount: FinancialAmount!
    description: String!
    balance: FinancialAmount!
  }

  " עמלה "
  type FeeTransaction implements Transaction {
    id: ID!
    referenceNumber: String!
    createdAt: Date!
    effectiveDate: TimelessDate!
    direction: TransactionDirection!
    amount: FinancialAmount!
    description: String!
    balance: FinancialAmount!
  }

  " המרה "
  type ConversionTransaction implements Transaction {
    id: ID!
    referenceNumber: String!
    createdAt: Date!
    effectiveDate: TimelessDate!
    direction: TransactionDirection!
    amount: FinancialAmount!
    description: String!
    balance: FinancialAmount!
    from: Currency!
    to: Currency!
    " המרה של הבנק "
    bankRate: Rate!
    " בנק ישראל "
    officialRate: Rate
  }

  " input variables for updateTransaction "
  input UpdateTransactionInput {
    # eslint-disable-next-line @graphql-eslint/no-hashtag-description -- field for the future
    # createdAt: Date!
    eventDate: TimelessDate
    effectiveDate: TimelessDate
    # eslint-disable-next-line @graphql-eslint/no-hashtag-description -- field for the future
    # direction: TransactionDirection
    amount: FinancialAmountInput
    description: String
    sourceDescription: String
    # eslint-disable-next-line @graphql-eslint/no-hashtag-description -- field for the future
    account: UUID
    balance: FinancialAmountInput
  }

  " result type for updateTransaction "
  union UpdateTransactionResult = CommonTransaction | CommonError # TODO: update to match more than common transaction
`;
