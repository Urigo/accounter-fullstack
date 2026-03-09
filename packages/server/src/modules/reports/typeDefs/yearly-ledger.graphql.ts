import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    yearlyLedgerReport(year: Int!): YearlyLedgerReport!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " yearly ledger report "
  type YearlyLedgerReport {
    id: ID!
    year: Int!
    financialEntitiesInfo: [YearlyLedgerReportFinancialEntityInfo!]!
  }

  " Vat report record "
  type YearlyLedgerReportFinancialEntityInfo {
    entity: FinancialEntity!
    openingBalance: FinancialAmount!
    totalCredit: FinancialAmount!
    totalDebit: FinancialAmount!
    closingBalance: FinancialAmount!
    records: [SingleSidedLedgerRecord!]!
  }

  " Ledger record with balance "
  type SingleSidedLedgerRecord {
    id: ID!
    amount: FinancialAmount!
    invoiceDate: DateTime!
    valueDate: DateTime!
    description: String
    reference: String
    counterParty: FinancialEntity
    balance: Float!
  }
`;
