import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
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

  extend interface Charge {
    exchangeRates: ExchangeRates
  }

  extend type CommonCharge {
    exchangeRates: ExchangeRates
  }

  extend type FinancialCharge {
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

  extend type BankDepositCharge {
    exchangeRates: ExchangeRates
  }

  extend type ForeignSecuritiesCharge {
    exchangeRates: ExchangeRates
  }

  extend type CreditcardBankCharge {
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

  extend type ConversionTransaction {
    debitExchangeRates: ExchangeRates
    eventExchangeRates: ExchangeRates
    cryptoExchangeRate: ConversionRate
  }
`;
