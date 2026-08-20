import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " Every business that stands for a traded security, for pickers scoped to securities "
    allSecurityBusinesses: [LtdFinancialEntity!]! @requiresAuth
    " The full ingested life of one security: its holding and every execution "
    securityBusinessHistory(businessId: UUID!): SecurityBusinessHistory! @requiresAuth
    " Every security the tenant holds, with the position its executions add up to. Closed positions — sold out, or never ingested — are left out unless asked for "
    securityHoldings(includeClosed: Boolean = false): [SecurityHolding!]! @requiresAuth
  }

  " One security and what is held of it, without the execution history behind it "
  type SecurityHolding {
    " The security's business id — the same id its own page is keyed by "
    id: UUID!
    security: SecurityBusiness!
    position: SecurityPosition!
  }

  " Everything a security business page shows "
  type SecurityBusinessHistory {
    id: UUID!
    security: SecurityBusiness!
    position: SecurityPosition!
    " Every ingested execution, oldest first "
    executions: [SecurityHistoryExecution!]!
  }

  " What the ingested executions add up to. Derived rather than reported — the bank's own holdings are not ingested, so the numbers are only as complete as the execution history behind them (see historyStartDate) "
  type SecurityPosition {
    " The security this position belongs to "
    id: UUID!
    " Units held, from the executions alone "
    quantity: Float!
    " Weighted average paid per unit bought; null when nothing was bought "
    averageCost: FinancialAmount
    totalBought: FinancialAmount
    totalSold: FinancialAmount
    " The earliest ingested execution — anything before it is invisible here "
    historyStartDate: TimelessDate
    lastExecutionDate: TimelessDate
  }

  " An execution with the cash movement behind it "
  type SecurityHistoryExecution {
    id: UUID!
    execution: SecurityExecution!
    " The charge the matched cash movement belongs to; null when no movement was matched "
    charge: Charge
    transaction: Transaction
  }

  extend type LtdFinancialEntity {
    " Security details; set only when this business stands for a single traded security "
    securityInfo: SecurityBusiness
  }

  " A business that stands for one traded security, identified by its ISIN "
  type SecurityBusiness {
    id: UUID!
    " The business this security is represented by "
    business: LtdFinancialEntity!
    isin: String!
    " How every ingesting source names this security "
    identifiers: [SecurityIdentifier!]!
    " Descriptors cached from the ingested rows; the securities feeds stay the source of truth "
    symbol: String
    engName: String
    hebName: String
    exchange: String
    " The currency the security trades in; null when the source reported one we do not know "
    currencyCode: Currency
    itemType: String
    stockType: String
    isEtf: Boolean
    isForeign: Boolean
    issuerCountryCode: String
  }

  " One source's name for a security "
  type SecurityIdentifier {
    id: UUID!
    type: SecurityIdentifierType!
    value: String!
  }

  " The sources a security can be identified by "
  enum SecurityIdentifierType {
    " Poalim's proprietary security key, as carried by transaction descriptions "
    POALIM_SECURITY_KEY
    ISIN
  }
`;
