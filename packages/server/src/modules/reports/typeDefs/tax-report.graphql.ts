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
    profitBeforeTax: TaxReportCommentary!
    researchAndDevelopmentExpensesByRecords: TaxReportCommentary!
    researchAndDevelopmentExpensesForTax: FinancialAmount!
    taxableIncome: FinancialAmount!
    taxRate: Float!
    annualTaxExpense: FinancialAmount!
  }

  " result type for profitAndLossReport "
  type TaxReportCommentary {
    amount: FinancialAmount!
    records: [LedgerRecord!]!
  }
`;
