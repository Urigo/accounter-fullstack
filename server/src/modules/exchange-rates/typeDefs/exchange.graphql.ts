import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    " get exchage rates by date "
    exchangeRates(date: TimelessDate): ExchangeRates
  }

  " represent a financial amount in a specific currency "
  type ExchangeRates {
    usd: FinancialAmount
    gbp: FinancialAmount
    eur: FinancialAmount
    date: TimelessDate!
  }
`;
