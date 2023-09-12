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

  extend interface Charge {
    exchangeRates: ExchangeRates
  }

  extend type CommonCharge {
    exchangeRates: ExchangeRates
  }

  extend type ConversionCharge {
    exchangeRates: ExchangeRates
  }

  extend interface Transaction {
    debitExchangeRates: ExchangeRates
    eventExchangeRates: ExchangeRates
  }

  extend type CommonTransaction {
    debitExchangeRates: ExchangeRates
    eventExchangeRates: ExchangeRates
  }

  extend type WireTransaction {
    debitExchangeRates: ExchangeRates
    eventExchangeRates: ExchangeRates
  }

  extend type FeeTransaction {
    debitExchangeRates: ExchangeRates
    eventExchangeRates: ExchangeRates
  }

  extend type ConversionTransaction {
    debitExchangeRates: ExchangeRates
    eventExchangeRates: ExchangeRates
  }
`;
