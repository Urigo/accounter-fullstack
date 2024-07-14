import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    profitAndLossReport(years: [Int!]!): [ProfitAndLossReport!]! @auth(role: ACCOUNTANT)
  }

  " result type for profitAndLossReport "
  type ProfitAndLossReport {
    year: Int!
    revenue: FinancialAmount!
    costOfSales: FinancialAmount!
    grossProfit: FinancialAmount!

    researchAndDevelopmentExpenses: FinancialAmount!
    marketingExpenses: FinancialAmount!
    managementAndGeneralExpenses: FinancialAmount!
    operatingProfit: FinancialAmount!

    financialExpenses: FinancialAmount!
    profitBeforeTax: FinancialAmount!

    tax: FinancialAmount!
    netProfit: FinancialAmount!
  }
`;
