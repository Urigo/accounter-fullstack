import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    transactionsByIDs(transactionIDs: [UUID!]!): [Transaction!]! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    updateTransaction(
      transactionId: UUID!
      fields: UpdateTransactionInput!
    ): UpdateTransactionResult! @auth(role: ACCOUNTANT)
  }

  extend interface Charge {
    " list of financial/bank transactions linked to the charge "
    transactions: [Transaction!]!
  }

  extend type CommonCharge {
    transactions: [Transaction!]!
  }

  extend type FinancialCharge {
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

  extend type MonthlyVatCharge {
    transactions: [Transaction!]!
  }

  extend type BankDepositCharge {
    transactions: [Transaction!]!
  }

  extend type CreditcardBankCharge {
    transactions: [Transaction!]!
  }

  " Represent a general transaction object "
  interface Transaction {
    id: UUID!
    " external key / identifier in the bank or card (אסמכתא) "
    referenceKey: String
    " eventDate "
    eventDate: TimelessDate!
    " debitDate "
    effectiveDate: TimelessDate # TODO: this should be required, but lots are missing in the DB
    " debitDate without user overrides and completions "
    sourceEffectiveDate: TimelessDate
    " debitTimeStamp "
    exactEffectiveDate: DateTime
    " either credit or debit "
    direction: TransactionDirection!
    " the amount of the transaction "
    amount: FinancialAmount!
    " description of the transaction, as defined by the bank/card "
    sourceDescription: String!
    " effective bank / card balance, after the transaction "
    balance: FinancialAmount!
    " when the initial transaction was created from the first event we found "
    createdAt: DateTime!
    " when the transaction was last updated "
    updatedAt: DateTime!
    " is this transaction a fee? "
    isFee: Boolean
    " containing charge ID "
    chargeId: UUID!
  }

  " The direction of the transaction "
  enum TransactionDirection {
    DEBIT
    CREDIT
  }

  " temp type until DB supports transactions differentiation "
  type CommonTransaction implements Transaction {
    id: UUID!
    referenceKey: String
    eventDate: TimelessDate!
    effectiveDate: TimelessDate # TODO: this should be required, but lots are missing in the DB
    sourceEffectiveDate: TimelessDate
    exactEffectiveDate: DateTime
    direction: TransactionDirection!
    amount: FinancialAmount!
    sourceDescription: String!
    balance: FinancialAmount!
    createdAt: DateTime!
    updatedAt: DateTime!
    isFee: Boolean
    chargeId: UUID!
  }

  " המרה "
  type ConversionTransaction implements Transaction {
    id: UUID!
    referenceKey: String
    eventDate: TimelessDate!
    effectiveDate: TimelessDate!
    sourceEffectiveDate: TimelessDate
    exactEffectiveDate: DateTime
    direction: TransactionDirection!
    amount: FinancialAmount!
    sourceDescription: String!
    balance: FinancialAmount!
    type: ConversionTransactionType!
    " המרה של הבנק "
    bankRate: Rate!
    " בנק ישראל "
    officialRateToLocal: Rate
    createdAt: DateTime!
    updatedAt: DateTime!
    isFee: Boolean
    chargeId: UUID!
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
    counterpartyId: UUID
    chargeId: UUID
    effectiveDate: TimelessDate
    isFee: Boolean
  }

  " result type for updateTransaction "
  union UpdateTransactionResult = CommonTransaction | ConversionTransaction | CommonError # TODO: update to match more than common transaction
`;
