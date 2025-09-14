import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    profitAndLossReport(reportYear: Int!, referenceYears: [Int!]!): ProfitAndLossReport!
      @auth(role: ACCOUNTANT)
  }

  " result type for profitAndLossReport "
  type ProfitAndLossReport {
    id: ID!
    report: ProfitAndLossReportYear!
    reference: [ProfitAndLossReportYear!]!
  }

  " profit and loss data for a single year "
  type ProfitAndLossReportYear {
    id: ID!
    year: Int!
    revenue: ReportCommentary!
    costOfSales: ReportCommentary!
    grossProfit: FinancialAmount!

    researchAndDevelopmentExpenses: ReportCommentary!
    marketingExpenses: ReportCommentary!
    managementAndGeneralExpenses: ReportCommentary!
    operatingProfit: FinancialAmount!

    financialExpenses: ReportCommentary!
    otherIncome: ReportCommentary!
    profitBeforeTax: FinancialAmount!

    tax: FinancialAmount!
    netProfit: FinancialAmount!
  }
`;
