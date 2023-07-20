import { GraphQLError } from 'graphql';
import { Currency } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import { ExchangeProvider } from '../providers/exchange.provider.js';
import type { ExchangeRatesModule } from '../types.js';

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
        .get(ExchangeProvider)
        .getExchangeRates(new Date(timelessDate));
      return formatFinancialAmount(exchangeRates.usd, Currency.Usd) ?? null;
    },
    gbp: async (timelessDate, _, { injector }) => {
      const exchangeRates = await injector
        .get(ExchangeProvider)
        .getExchangeRates(new Date(timelessDate));
      return formatFinancialAmount(exchangeRates.gbp, Currency.Gbp) ?? null;
    },
    eur: async (timelessDate, _, { injector }) => {
      const exchangeRates = await injector
        .get(ExchangeProvider)
        .getExchangeRates(new Date(timelessDate));
      return formatFinancialAmount(exchangeRates.eur, Currency.Eur) ?? null;
    },
    date: timelessDate => timelessDate,
  },
};
