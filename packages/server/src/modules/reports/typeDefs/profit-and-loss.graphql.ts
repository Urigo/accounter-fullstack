import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
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
    revenue: ProfitAndLossCommentary!
    costOfSales: ProfitAndLossCommentary!
    grossProfit: FinancialAmount!

    researchAndDevelopmentExpenses: ProfitAndLossCommentary!
    marketingExpenses: ProfitAndLossCommentary!
    managementAndGeneralExpenses: ProfitAndLossCommentary!
    operatingProfit: FinancialAmount!

    financialExpenses: ProfitAndLossCommentary!
    otherIncome: ProfitAndLossCommentary!
    profitBeforeTax: FinancialAmount!

    tax: FinancialAmount!
    netProfit: FinancialAmount!
  }

  " result type for profitAndLossReport "
  type ProfitAndLossCommentary {
    amount: FinancialAmount!
    records: [LedgerRecord!]!
  }
`;
