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

  " represent exchange rate between two currencies "
  type ConversionRate {
    from: Currency!
    to: Currency!
    rate: Float!
  }

  extend interface Charge {
    exchangeRates: ExchangeRates
  }

  extend type CommonCharge {
    exchangeRates: ExchangeRates
  }

  extend type ConversionCharge {
    exchangeRates: ExchangeRates
    eventRate: ConversionRate
    officialRate: ConversionRate
  }

  extend type SalaryCharge {
    exchangeRates: ExchangeRates
  }

  extend type InternalTransferCharge {
    exchangeRates: ExchangeRates
  }

  extend type DividendCharge {
    exchangeRates: ExchangeRates
  }

  extend type BusinessTripCharge {
    exchangeRates: ExchangeRates
  }

  extend type MonthlyVatCharge {
    exchangeRates: ExchangeRates
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

  extend type WireTransaction {
    debitExchangeRates: ExchangeRates
    eventExchangeRates: ExchangeRates
    cryptoExchangeRate: ConversionRate
  }

  extend type FeeTransaction {
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
