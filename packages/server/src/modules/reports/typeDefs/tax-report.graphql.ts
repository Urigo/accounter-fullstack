import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    taxReport(reportYear: Int!, referenceYears: [Int!]!): TaxReport!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " result type for taxReport "
  type TaxReport {
    id: ID!
    report: TaxReportYear!
    reference: [TaxReportYear!]!
  }

  " tax data for a single year "
  type TaxReportYear {
    id: ID!
    year: Int!
    profitBeforeTax: ReportCommentary!
    researchAndDevelopmentExpensesByRecords: ReportCommentary!
    researchAndDevelopmentExpensesForTax: FinancialAmount!

    fines: ReportCommentary!
    untaxableGifts: ReportCommentary!
    " Donations (non-deductible; tax category set in the admin context) "
    donations: ReportCommentary!
    businessTripsExcessExpensesAmount: FinancialAmount!
    salaryExcessExpensesAmount: FinancialAmount!
    reserves: ReportCommentary!
    nontaxableLinkage: ReportCommentary!

    taxableIncome: FinancialAmount!
    taxRate: Float!
    specialTaxableIncome: ReportCommentary!
    specialTaxRate: Float!
    " current tax for the year; never negative (0 in a loss year) "
    annualTaxExpense: FinancialAmount!
    " total taxable loss for the year as a positive amount, or 0 "
    taxableLoss: FinancialAmount!
    " regular-rate and preferred-rate (sort code 991) incomes have opposite signs, so the tax nets a loss against a profit at different rates; confirm with the accountant "
    mixedRateLoss: Boolean!
  }

  " Tax report commentary summary "
  type ReportCommentary {
    amount: FinancialAmount!
    records: [ReportCommentaryRecord!]!
  }

  " Report commentary record "
  type ReportCommentaryRecord {
    sortCode: SortCode!
    amount: FinancialAmount!
    records: [ReportCommentarySubRecord!]!
  }

  " Report commentary sub-record "
  type ReportCommentarySubRecord {
    financialEntity: FinancialEntity!
    amount: FinancialAmount!
    " ledger records formulating the financial entity sum "
    ledgerRecords: [LedgerRecord!]!
  }
`;
