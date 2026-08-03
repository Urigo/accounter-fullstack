import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    transactionsByIDs(transactionIDs: [UUID!]!): [Transaction!]! @requiresAuth
    transactionsByFinancialEntity(financialEntityID: UUID!): [Transaction!]! @requiresAuth
    " fetch transactions filtered by the given criteria "
    transactionsByFilters(filters: TransactionsFilters): [Transaction!]! @requiresAuth
  }

  " filter options for the transactionsByFilters query "
  input TransactionsFilters {
    " Include only transactions with one of these transaction ids "
    byIds: [UUID!]
    " Include only transactions linked to one of these charges "
    byChargeIds: [UUID!]
    " Include only transactions owned by one of these financial entities (must be within the authorized read scope) "
    byOwners: [UUID!]
    " Include only transactions with event date on or after this date "
    fromEventDate: TimelessDate
    " Include only transactions with event date on or before this date "
    toEventDate: TimelessDate
    " Include only transactions with debit date on or after this date "
    fromDebitDate: TimelessDate
    " Include only transactions with debit date on or before this date "
    toDebitDate: TimelessDate
    " Include only transactions with any date (event or debit) on or after this date "
    fromAnyDate: TimelessDate
    " Include only transactions with any date (event or debit) on or before this date "
    toAnyDate: TimelessDate
    " Include only transactions whose counterparty is one of these financial entities "
    byCounterparties: [UUID!]
    " Include only transactions with a missing counterparty (no linked business) "
    withMissingCounterparty: Boolean
    " Include only transactions with missing required info (fail transaction validation) "
    withMissingInfo: Boolean
    " Include only transactions matching this free text (source description / reference, amount, counter account, origin key, counterparty name) "
    freeText: String
  }

  extend type Mutation {
    updateTransaction(
      transactionId: UUID!
      fields: UpdateTransactionInput!
    ): UpdateTransactionResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateTransactions(
      transactionIds: [UUID!]!
      fields: UpdateTransactionInput!
    ): UpdateTransactionsResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
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

  extend type ForeignSecuritiesCharge {
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
  " result type for updateTransactions "
  union UpdateTransactionsResult = UpdatedTransactionsSuccessfulResult | CommonError # TODO: update to match more than common transaction
  " result type for successful updateTransactions mutation "
  union UpdatedTransaction = CommonTransaction | ConversionTransaction
  " result type for successful updateTransactions mutation "
  type UpdatedTransactionsSuccessfulResult {
    transactions: [UpdatedTransaction!]!
  }
`;
