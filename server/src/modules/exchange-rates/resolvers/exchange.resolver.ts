import { GraphQLError } from 'graphql';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY, DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import { Currency } from '@shared/gql-types';
import { formatCurrency, formatFinancialAmount } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import { defineConversionBaseAndQuote, isCryptoCurrency } from '../helpers/exchange.helper.js';
import { CryptoExchangeProvider } from '../providers/crypto-exchange.provider.js';
import { ExchangeProvider } from '../providers/exchange.provider.js';
import { FiatExchangeProvider } from '../providers/fiat-exchange.provider.js';
import type { ExchangeRatesModule } from '../types.js';
import { commonChargeFields, commonTransactionFields } from './common.js';

export const exchangeResolvers: ExchangeRatesModule.Resolvers = {
  Query: {
    exchangeRates: async (_, { date }) => {
      if (!date) {
        throw new GraphQLError('Date is required');
      }
      return date as TimelessDateString;
    },
  },
  ExchangeRates: {
    usd: async (timelessDate, _, { injector }) => {
      const exchangeRates = await injector
        .get(FiatExchangeProvider)
        .getExchangeRatesByDatesLoader.load(new Date(timelessDate));
      if (!exchangeRates?.usd) {
        return null;
      }
      return formatFinancialAmount(exchangeRates.usd, Currency.Usd) ?? null;
    },
    gbp: async (timelessDate, _, { injector }) => {
      const exchangeRates = await injector
        .get(FiatExchangeProvider)
        .getExchangeRatesByDatesLoader.load(new Date(timelessDate));
      if (!exchangeRates?.gbp) {
        return null;
      }
      return formatFinancialAmount(exchangeRates.gbp, Currency.Gbp) ?? null;
    },
    eur: async (timelessDate, _, { injector }) => {
      const exchangeRates = await injector
        .get(FiatExchangeProvider)
        .getExchangeRatesByDatesLoader.load(new Date(timelessDate));
      if (!exchangeRates?.eur) {
        return null;
      }
      return formatFinancialAmount(exchangeRates.eur, Currency.Eur) ?? null;
    },
    date: timelessDate => timelessDate,
  },
  CommonCharge: commonChargeFields,
  ConversionCharge: {
    ...commonChargeFields,
    directRate: async (dbCharge, _, { injector }) => {
      const transactions = await injector
        .get(TransactionsProvider)
        .getTransactionsByChargeIDLoader.load(dbCharge.id);
      if (!transactions) {
        throw new GraphQLError(`Couldn't find any transactions for charge ID="${dbCharge.id}"`);
      }
      const { baseTransaction, quoteTransaction } = defineConversionBaseAndQuote(transactions);

      const baseCurrency = formatCurrency(baseTransaction.currency);
      const quoteCurrency = formatCurrency(quoteTransaction.currency);

      const rate = await injector
        .get(ExchangeProvider)
        .getExchangeRates(baseCurrency, quoteCurrency, baseTransaction.debit_date);

      return {
        from: baseCurrency,
        to: quoteCurrency,
        rate,
      };
    },
    toLocalRate: async (dbCharge, _, { injector }) => {
      const transactions = await injector
        .get(TransactionsProvider)
        .getTransactionsByChargeIDLoader.load(dbCharge.id);
      if (!transactions) {
        throw new GraphQLError(`Couldn't find any transactions for charge ID="${dbCharge.id}"`);
      }
      const { quoteTransaction } = defineConversionBaseAndQuote(transactions);

      const quoteCurrency = formatCurrency(quoteTransaction.currency);

      const rate = await injector
        .get(ExchangeProvider)
        .getExchangeRates(quoteCurrency, DEFAULT_LOCAL_CURRENCY, quoteTransaction.debit_date);

      return {
        from: quoteCurrency,
        to: DEFAULT_LOCAL_CURRENCY,
        rate,
      };
    },
    cryptoToFiat: async (dbCharge, _, { injector }) => {
      const transactions = await injector
        .get(TransactionsProvider)
        .getTransactionsByChargeIDLoader.load(dbCharge.id);
      if (!transactions) {
        throw new GraphQLError(`Couldn't find any transactions for charge ID="${dbCharge.id}"`);
      }
      const { baseTransaction } = defineConversionBaseAndQuote(transactions);

      const baseCurrency = formatCurrency(baseTransaction.currency);

      if (isCryptoCurrency(baseCurrency)) {
        const { value } = await injector
          .get(CryptoExchangeProvider)
          .getCryptoExchangeRateLoader.load({
            cryptoCurrency: baseCurrency,
            date: baseTransaction.debit_date,
          });

        return {
          from: baseCurrency,
          to: DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY,
          rate: Number(value),
        };
      }

      return {
        from: baseCurrency,
        to: baseCurrency,
        rate: 1,
      };
    },
  },
  // WireTransaction: {
  //   ...commonTransactionFields,
  // },
  // FeeTransaction: {
  //   ...commonTransactionFields,
  // },
  // ConversionTransaction: {
  //   ...commonTransactionFields,
  // },
  CommonTransaction: {
    ...commonTransactionFields,
  },
};
