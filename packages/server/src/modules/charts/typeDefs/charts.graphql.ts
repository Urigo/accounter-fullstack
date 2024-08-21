import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    incomeExpenseChart(filters: IncomeExpenseChartFilters!): IncomeExpenseChart!
      @auth(role: ACCOUNTANT)
  }

  " income chart information "
  type IncomeExpenseChart {
    fromDate: TimelessDate!
    toDate: TimelessDate!
    monthlyData: [IncomeExpenseChartMonthData!]!
  }

  " income chart month information "
  type IncomeExpenseChartMonthData {
    date: TimelessDate!
    income: FinancialAmount!
    expense: FinancialAmount!
    balance: FinancialAmount!
  }

  " input variables for incomeExpenseChart filters "
  input IncomeExpenseChartFilters {
    fromDate: TimelessDate!
    toDate: TimelessDate!
    currency: Currency
  }
`;
