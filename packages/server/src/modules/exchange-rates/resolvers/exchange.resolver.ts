import { GraphQLError } from 'graphql';
import { TransactionsNewProvider } from '@modules/transactions/providers/transactions-new.provider.js';
import { TransactionsSourceProvider } from '@modules/transactions/providers/transactions-source.provider.js';
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
    cad: async (timelessDate, _, { injector }) => {
      const exchangeRates = await injector
        .get(FiatExchangeProvider)
        .getExchangeRatesByDatesLoader.load(new Date(timelessDate));
      if (!exchangeRates?.cad) {
        return null;
      }
      return formatFinancialAmount(exchangeRates.cad, Currency.Cad) ?? null;
    },
    date: timelessDate => timelessDate,
  },
  CommonCharge: commonChargeFields,
  FinancialCharge: commonChargeFields,
  ConversionCharge: {
    ...commonChargeFields,
    officialRate: async (dbCharge, _, { injector }) => {
      const transactions = await injector
        .get(TransactionsNewProvider)
        .transactionsByChargeIDLoader.load(dbCharge.id);
      if (!transactions) {
        throw new GraphQLError(`Couldn't find any transactions for charge ID="${dbCharge.id}"`);
      }
      const { baseTransaction, quoteTransaction } = await defineConversionBaseAndQuote(
        transactions,
        injector,
      );

      const [baseSourceInfo, quoteSourceInfo] = await injector
        .get(TransactionsSourceProvider)
        .transactionSourceByIdLoader.loadMany([baseTransaction.id, quoteTransaction.id]);

      const baseCurrency = formatCurrency(baseTransaction.currency);
      const quoteCurrency = formatCurrency(quoteTransaction.currency);
      const baseDebitTimestamp =
        baseSourceInfo instanceof Error ? undefined : baseSourceInfo.debit_timestamp;
      const quoteDebitTimestamp =
        quoteSourceInfo instanceof Error ? undefined : quoteSourceInfo.debit_timestamp;
      const date = baseDebitTimestamp || quoteDebitTimestamp || baseTransaction.debit_date;

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
        .get(TransactionsNewProvider)
        .transactionsByChargeIDLoader.load(dbCharge.id);
      const { baseTransaction, quoteTransaction } = await defineConversionBaseAndQuote(
        transactions,
        injector,
      );

      const baseCurrency = formatCurrency(baseTransaction.currency);
      const quoteCurrency = formatCurrency(quoteTransaction.currency);

      let rate: number | undefined = undefined;
      for (const transaction of [baseTransaction, quoteTransaction]) {
        const sourceInfo = await injector
          .get(TransactionsSourceProvider)
          .transactionSourceByIdLoader.load(transaction.id);
        if (sourceInfo.currency_rate && sourceInfo.currency_rate !== '0') {
          const transactionRate = Number(sourceInfo.currency_rate);
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
