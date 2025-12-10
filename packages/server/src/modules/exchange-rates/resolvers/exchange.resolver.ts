import { GraphQLError } from 'graphql';
import { Currency } from '../../../shared/enums.js';
import { dateToTimelessDateString, formatCurrency } from '../../../shared/helpers/index.js';
import { TimelessDateString } from '../../../shared/types/index.js';
import {
  getChargeDocumentsMeta,
  getChargeLedgerMeta,
  getChargeTransactionsMeta,
} from '../../charges/helpers/common.helper.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import { defineConversionBaseAndQuote, getFiatExchangeRate } from '../helpers/exchange.helper.js';
import { ExchangeProvider } from '../providers/exchange.provider.js';
import type { ExchangeRatesModule } from '../types.js';
import { commonTransactionFields } from './common.js';

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
  FinancialCharge: {
    exchangeRates: async (DbCharge, _, { injector }) => {
      const [{ transactionsMinDebitDate }, { ledgerMinInvoiceDate }, { documentsMinDate }] =
        await Promise.all([
          getChargeTransactionsMeta(DbCharge.id, injector),
          getChargeLedgerMeta(DbCharge.id, injector),
          getChargeDocumentsMeta(DbCharge.id, injector),
        ]);

      const ratesDate = transactionsMinDebitDate || documentsMinDate || ledgerMinInvoiceDate;

      if (!ratesDate) {
        return null;
      }

      return dateToTimelessDateString(ratesDate);
    },
  },
  ConversionCharge: {
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
  CommonTransaction: {
    ...commonTransactionFields,
  },
  ConversionTransaction: {
    ...commonTransactionFields,
  },
};
