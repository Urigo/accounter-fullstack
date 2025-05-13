import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    taxReport(reportYear: Int!, referenceYears: [Int!]!): TaxReport! @auth(role: ACCOUNTANT)
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
    businessTripsExcessExpensesAmount: FinancialAmount!
    salaryExcessExpensesAmount: FinancialAmount!
    reserves: ReportCommentary!
    nontaxableLinkage: ReportCommentary!

    taxableIncome: FinancialAmount!
    taxRate: Float!
    specialTaxableIncome: ReportCommentary!
    specialTaxRate: Float!
    annualTaxExpense: FinancialAmount!
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
  }
`;
