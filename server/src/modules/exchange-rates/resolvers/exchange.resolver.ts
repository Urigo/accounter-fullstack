import { GraphQLError } from 'graphql';
import { Currency } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
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
  ConversionCharge: commonChargeFields,
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
