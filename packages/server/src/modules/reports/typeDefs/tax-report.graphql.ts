import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    taxReport(years: [Int!]!): [TaxReport!]! @auth(role: ACCOUNTANT)
  }

  " result type for taxReport "
  type TaxReport {
    year: Int!
    profitBeforeTax: FinancialAmount!
    researchAndDevelopmentExpensesByRecords: FinancialAmount!
    researchAndDevelopmentExpensesForTax: FinancialAmount!
    depreciationForTax: FinancialAmount!
    taxableIncome: FinancialAmount!
    taxRate: Float!
    annualTaxExpense: FinancialAmount!
  }
`;
