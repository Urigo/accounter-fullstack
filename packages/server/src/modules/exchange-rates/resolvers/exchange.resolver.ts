import { GraphQLError } from 'graphql';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { Currency } from '@shared/gql-types';
import { formatCurrency, formatFinancialAmount } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import { defineConversionBaseAndQuote } from '../helpers/exchange.helper.js';
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
    officialRate: async (dbCharge, _, { injector }) => {
      const transactions = await injector
        .get(TransactionsProvider)
        .getTransactionsByChargeIDLoader.load(dbCharge.id);
      if (!transactions) {
        throw new GraphQLError(`Couldn't find any transactions for charge ID="${dbCharge.id}"`);
      }
      const { baseTransaction, quoteTransaction } = defineConversionBaseAndQuote(transactions);

      const baseCurrency = formatCurrency(baseTransaction.currency);
      const quoteCurrency = formatCurrency(quoteTransaction.currency);
      const date =
        baseTransaction.debit_timestamp ||
        quoteTransaction.debit_timestamp ||
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
        .getTransactionsByChargeIDLoader.load(dbCharge.id);
      if (!transactions) {
        throw new GraphQLError(`Couldn't find any transactions for charge ID="${dbCharge.id}"`);
      }
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
  // WireTransaction: {
  //   ...commonTransactionFields,
  // },
  // FeeTransaction: {
  //   ...commonTransactionFields,
  // },
  ConversionTransaction: {
    ...commonTransactionFields,
  },
  CommonTransaction: {
    ...commonTransactionFields,
  },
};
