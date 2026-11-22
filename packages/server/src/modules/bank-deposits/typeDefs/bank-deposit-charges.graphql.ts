import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    depositByCharge(chargeId: UUID!): BankDeposit @requiresAuth
    relevantDepositsForCharge(chargeId: UUID!): RelevantDepositsResult! @requiresAuth
  }

  " Result of relevantDepositsForCharge: matched open deposits, or an error if the charge has multiple currencies or accounts "
  type RelevantDepositsResult {
    id: ID!
    deposits: [BankDeposit!]!
    " Set when the charge transactions have multiple currencies or multiple accounts "
    error: String
  }

  extend type Mutation {
    assignChargeToDeposit(chargeId: UUID!, depositId: String!): BankDeposit!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    createDepositFromCharge(chargeId: UUID!, name: String!): BankDeposit!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " Metadata for Bank Deposit, including current balance, total interest, total deposit amount, and associated transactions. "
  type BankDepositMetadata {
    id: ID!
    currentBalance: FinancialAmount!
    totalInterest: FinancialAmount!
    totalDeposit: FinancialAmount!
    potentialCloseDate: TimelessDate
    transactions: [Transaction!]!
  }

  extend type BankDeposit {
    metadata: BankDepositMetadata!
    " The deposit replayed event by event the way the bank treats it (see the deposit ledger) "
    timeline: BankDepositTimeline!
  }

  " Where a timeline step's capitalized interest and tax come from "
  enum BankDepositTimelineSource {
    " The bank's deposits tax-collection report "
    BANK
    " The bank's report, split among several deposits with an event on the same day "
    BANK_ALLOCATED
    " Inferred from the closed deposit's unexplained principal "
    INFERRED
  }

  " One deposit event (a charge): what the bank realized on it and the principal it left "
  type BankDepositTimelineStep {
    id: ID!
    chargeId: UUID!
    date: TimelessDate!
    " Principal moved into (+) or out of (−) the deposit, deposit currency "
    principalFlow: FinancialAmount!
    " Interest paid out with the event (the charge's interest lines), deposit currency "
    visibleInterest: FinancialAmount!
    " FX revaluation of the carried principal, local currency "
    revaluation: FinancialAmount!
    " Interest the bank capitalized into the deposit, deposit currency "
    capitalizedInterest: FinancialAmount!
    " Interest the bank capitalized into the deposit, local currency "
    capitalizedInterestLocal: FinancialAmount!
    " Tax the bank withheld inside the deposit (on the capitalized interest), local currency "
    taxCapitalized: FinancialAmount!
    " Tax the bank withheld from the paid-out interest, local currency "
    taxPaidOut: FinancialAmount!
    " Principal left in the deposit after the event, deposit currency "
    principalAfter: FinancialAmount!
    " Book value of the deposit after the event, local currency "
    localBalanceAfter: FinancialAmount!
    source: BankDepositTimelineSource
    warnings: [String!]!
  }

  " A bank deposits tax-collection row of the deposit's account that matched no deposit event "
  type BankDepositUnmatchedTaxEvent {
    id: ID!
    date: TimelessDate!
    actionTypeDescription: String!
    taxableAmount: FinancialAmount!
  }

  " A deposit's event-by-event accounting "
  type BankDepositTimeline {
    id: ID!
    steps: [BankDepositTimelineStep!]!
    unmatchedTaxEvents: [BankDepositUnmatchedTaxEvent!]!
    warnings: [String!]!
  }
`;
