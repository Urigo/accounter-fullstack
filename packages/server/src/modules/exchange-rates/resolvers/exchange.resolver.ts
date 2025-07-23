import { GraphQLError } from 'graphql';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { Currency } from '@shared/gql-types';
import { formatCurrency } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import { defineConversionBaseAndQuote, getFiatExchangeRate } from '../helpers/exchange.helper.js';
import { ExchangeProvider } from '../providers/exchange.provider.js';
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
    usd: async (timelessDate, _, { injector }) =>
      getFiatExchangeRate(injector, timelessDate, 'usd'),
    gbp: async (timelessDate, _, { injector }) =>
      getFiatExchangeRate(injector, timelessDate, 'gbp'),
    eur: async (timelessDate, _, { injector }) =>
      getFiatExchangeRate(injector, timelessDate, 'eur'),
    cad: async (timelessDate, _, { injector }) =>
      getFiatExchangeRate(injector, timelessDate, 'cad'),
    jpy: async (timelessDate, _, { injector }) =>
      getFiatExchangeRate(injector, timelessDate, 'jpy'),
    aud: async (timelessDate, _, { injector }) =>
      getFiatExchangeRate(injector, timelessDate, 'aud'),
    sek: async (timelessDate, _, { injector }) =>
      getFiatExchangeRate(injector, timelessDate, 'sek'),
    ils: () => {
      return 1;
    },
    grt: async (timelessDate, _, { injector, adminContext: { defaultLocalCurrency } }) => {
      const exchangeRates = await injector
        .get(ExchangeProvider)
        .getExchangeRates(Currency.Grt, defaultLocalCurrency, new Date(timelessDate));
      if (!exchangeRates) {
        return null;
      }
      return typeof exchangeRates === 'string' ? parseFloat(exchangeRates) : exchangeRates;
    },
    eth: async (timelessDate, _, { injector, adminContext: { defaultLocalCurrency } }) => {
      const exchangeRates = await injector
        .get(ExchangeProvider)
        .getExchangeRates(Currency.Eth, defaultLocalCurrency, new Date(timelessDate));
      if (!exchangeRates) {
        return null;
      }
      return typeof exchangeRates === 'string' ? parseFloat(exchangeRates) : exchangeRates;
    },
    usdc: async (timelessDate, _, { injector, adminContext: { defaultLocalCurrency } }) => {
      const exchangeRates = await injector
        .get(ExchangeProvider)
        .getExchangeRates(Currency.Usdc, defaultLocalCurrency, new Date(timelessDate));
      if (!exchangeRates) {
        return null;
      }
      return typeof exchangeRates === 'string' ? parseFloat(exchangeRates) : exchangeRates;
    },
    date: timelessDate => timelessDate,
  },
  CommonCharge: commonChargeFields,
  FinancialCharge: commonChargeFields,
  ConversionCharge: {
    ...commonChargeFields,
    officialRate: async (dbCharge, _, { injector }) => {
      const transactions = await injector
        .get(TransactionsProvider)
        .transactionsByChargeIDLoader.load(dbCharge.id);
      if (!transactions) {
        throw new GraphQLError(`Couldn't find any transactions for charge ID="${dbCharge.id}"`);
      }
      const { baseTransaction, quoteTransaction } = defineConversionBaseAndQuote(transactions);

      const baseCurrency = formatCurrency(baseTransaction.currency);
      const quoteCurrency = formatCurrency(quoteTransaction.currency);
      const date =
        baseTransaction.debit_timestamp ||
        quoteTransaction.debit_timestamp ||
        baseTransaction.debit_date_override ||
        baseTransaction.debit_date;

      const rate = await injector
        .get(ExchangeProvider)
        .getExchangeRates(baseCurrency, quoteCurrency, date);

      return {
        from: baseCurrency,
        to: quoteCurrency,
        rate,
      };
    },
    eventRate: async (dbCharge, _, { injector }) => {
      const transactions = await injector
        .get(TransactionsProvider)
        .transactionsByChargeIDLoader.load(dbCharge.id);
      const { baseTransaction, quoteTransaction } = defineConversionBaseAndQuote(transactions);

      const baseCurrency = formatCurrency(baseTransaction.currency);
      const quoteCurrency = formatCurrency(quoteTransaction.currency);

      let rate: number | undefined = undefined;
      for (const transaction of [baseTransaction, quoteTransaction]) {
        if (transaction.currency_rate && transaction.currency_rate !== '0') {
          const transactionRate = Number(transaction.currency_rate);
          if (rate && rate !== transactionRate) {
            throw new GraphQLError(`Multiple rates found for charge ID="${dbCharge.id}"`);
          }
          rate = transactionRate;
        }
      }

      if (!rate) {
        throw new GraphQLError(`Couldn't find any rate for charge ID="${dbCharge.id}"`);
      }

      return {
        from: baseCurrency,
        to: quoteCurrency,
        rate,
      };
    },
  },
  SalaryCharge: commonChargeFields,
  InternalTransferCharge: commonChargeFields,
  DividendCharge: commonChargeFields,
  BusinessTripCharge: commonChargeFields,
  MonthlyVatCharge: commonChargeFields,
  BankDepositCharge: commonChargeFields,
  CreditcardBankCharge: commonChargeFields,
  ConversionTransaction: {
    ...commonTransactionFields,
  },
  CommonTransaction: {
    ...commonTransactionFields,
  },
};
