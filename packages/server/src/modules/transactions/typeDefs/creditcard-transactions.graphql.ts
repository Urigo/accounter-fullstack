import { gql } from 'graphql-modules';

export default gql`
  extend type CreditcardBankCharge {
    " card transactions settled by the charge's bank debits, flattened across its statements "
    creditCardTransactions: [Transaction!]!
    " true when every bank debit settles card statements whose totals equal the debit "
    validCreditCardAmount: Boolean!
    " card statements settled by the charge's bank debits, linked or confidently matched "
    creditCardStatements: [CreditCardStatement!]!
    " candidate statements for each bank debit that has no linked or matched statement "
    creditCardStatementSuggestions: [CreditCardStatementSuggestions!]!
  }

  extend type Mutation {
    " link a bank debit to the card statement(s) it settles (also confirms a computed match) "
    linkCreditCardStatements(
      bankTransactionId: UUID!
      statements: [CreditCardStatementKeyInput!]!
    ): CreditCardStatementLinkResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    " remove a stored link between a bank debit and a card statement "
    unlinkCreditCardStatement(
      bankTransactionId: UUID!
      statement: CreditCardStatementKeyInput!
    ): CreditCardStatementLinkResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " how a bank debit got linked to a card statement "
  enum CreditCardStatementLinkMethod {
    " the bank row identifies the card (reference, description or raw bank data) "
    REFERENCE
    " the amount matches the statement total (or a combination of statements) "
    AMOUNT
    " linked by a user "
    MANUAL
  }

  " a card billing cycle: the card account's transactions in one currency sharing a debit date "
  type CreditCardStatement {
    " synthetic id, derived from the card account, currency and debit date "
    id: ID!
    cardAccount: FinancialAccount!
    currency: Currency!
    debitDate: TimelessDate!
    " sum of the statement's card transactions "
    total: FinancialAmount!
    transactions: [Transaction!]!
    " the bank debit settling this statement, if linked or matched "
    bankTransaction: Transaction
    linkMethod: CreditCardStatementLinkMethod
    " true when the link is stored, false when it is a match computed on read or a suggestion "
    confirmed: Boolean!
  }

  " a candidate set of statements for a bank debit "
  type CreditCardStatementSuggestion {
    statements: [CreditCardStatement!]!
    " short explanation of the ranking "
    reason: String!
  }

  " ranked candidate statements for a bank debit that is not linked "
  type CreditCardStatementSuggestions {
    bankTransaction: Transaction!
    suggestions: [CreditCardStatementSuggestion!]!
  }

  " identifies a card statement "
  input CreditCardStatementKeyInput {
    cardAccountId: UUID!
    currency: Currency!
    debitDate: TimelessDate!
  }

  " result type for credit card statement link mutations "
  union CreditCardStatementLinkResult = CreditCardStatementLinkSuccessfulResult | CommonError

  " the charge of the bank debit, after the link change "
  type CreditCardStatementLinkSuccessfulResult {
    charge: Charge!
  }
`;
