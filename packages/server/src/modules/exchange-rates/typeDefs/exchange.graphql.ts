import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " get exchage rates by date "
    exchangeRates(date: TimelessDate): ExchangeRates @auth(role: ACCOUNTANT)
  }

  " represent a financial amount in a specific currency "
  type ExchangeRates {
    " fiat currencies "
    aud: Float
    cad: Float
    eur: Float
    gbp: Float
    ils: Float
    jpy: Float
    sek: Float
    usd: Float
    " crypto currencies "
    eth: Float
    grt: Float
    usdc: Float
    date: TimelessDate!
  }

  " represent exchange rate between two currencies "
  type ConversionRate {
    from: Currency!
    to: Currency!
    rate: Float!
  }

  extend type FinancialCharge {
    exchangeRates: ExchangeRates
  }

  extend type ConversionCharge {
    eventRate: ConversionRate
    officialRate: ConversionRate
  }

  extend interface Transaction {
    debitExchangeRates: ExchangeRates
    eventExchangeRates: ExchangeRates
    cryptoExchangeRate: ConversionRate
  }

  extend type CommonTransaction {
    debitExchangeRates: ExchangeRates
    eventExchangeRates: ExchangeRates
    cryptoExchangeRate: ConversionRate
  }

  extend type ConversionTransaction {
    debitExchangeRates: ExchangeRates
    eventExchangeRates: ExchangeRates
    cryptoExchangeRate: ConversionRate
  }
`;
