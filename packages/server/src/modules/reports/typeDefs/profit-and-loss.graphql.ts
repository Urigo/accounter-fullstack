import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    profitAndLossReport(year: Int!): ProfitAndLossReport! @auth(role: ACCOUNTANT)
  }

  " result type for profitAndLossReport "
  type ProfitAndLossReport {
    revenue: FinancialAmount!
    costOfSales: FinancialAmount!
    grossProfit: FinancialAmount!
    operatingExpenses: FinancialAmount!
    operatingProfit: FinancialAmount!

    otherIncome: FinancialAmount!
    otherExpenses: FinancialAmount!

    profitBeforeTax: FinancialAmount!
    tax: FinancialAmount!

    netProfit: FinancialAmount!
  }
`;
