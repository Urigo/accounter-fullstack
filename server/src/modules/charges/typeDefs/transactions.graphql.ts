import { gql } from 'graphql-modules';

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
    " user custom note, saved by the bank "
    userNote: String
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
    userNote: String
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
    userNote: String
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
    userNote: String
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
    userNote: String
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
    referenceNumber: String
    # eslint-disable-next-line @graphql-eslint/no-hashtag-description -- field for the future
    # createdAt: Date!
    effectiveDate: TimelessDate
    # eslint-disable-next-line @graphql-eslint/no-hashtag-description -- field for the future
    # direction: TransactionDirection
    amount: FinancialAmountInput
    # eslint-disable-next-line @graphql-eslint/no-hashtag-description -- field for the future
    # description: String // NOTE: which field should be updated? and should we update fields originated at bank/card info?
    userNote: String
    # eslint-disable-next-line @graphql-eslint/no-hashtag-description -- field for the future
    # account: FinancialAccount
    balance: FinancialAmountInput
  }

  " result type for updateTransaction "
  union UpdateTransactionResult = CommonTransaction | CommonError # TODO: update to match more than common transaction
`;
