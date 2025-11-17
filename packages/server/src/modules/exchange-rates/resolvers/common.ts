import { GraphQLError } from 'graphql';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { dateToTimelessDateString, formatCurrency } from '@shared/helpers';
import { isCryptoCurrency } from '../helpers/exchange.helper.js';
import { CryptoExchangeProvider } from '../providers/crypto-exchange.provider.js';
import { ExchangeRatesModule } from '../types.js';

export const commonTransactionFields:
  | ExchangeRatesModule.ConversionTransactionResolvers
  | ExchangeRatesModule.CommonTransactionResolvers = {
  debitExchangeRates: async (transactionId, _, { injector }) => {
    try {
      const transaction = await injector
        .get(TransactionsProvider)
        .transactionByIdLoader.load(transactionId);

      if (!transaction.debit_date || !transaction.debit_date_override) {
        return null;
      }

      return dateToTimelessDateString(transaction.debit_date_override || transaction.debit_date);
    } catch (e) {
      const message = 'Error fetching transaction debit date';
      console.error(message, e);
      throw new GraphQLError(message);
    }
  },
  eventExchangeRates: async (transactionId, _, { injector }) => {
    try {
      const transaction = await injector
        .get(TransactionsProvider)
        .transactionByIdLoader.load(transactionId);

      if (!transaction.event_date) {
        return null;
      }

      return dateToTimelessDateString(transaction.event_date);
    } catch (e) {
      const message = 'Error fetching transaction event date';
      console.error(message, e);
      throw new GraphQLError(message);
    }
  },
  cryptoExchangeRate: async (
    transactionId,
    _,
    { injector, adminContext: { defaultCryptoConversionFiatCurrency } },
  ) => {
    try {
      const transaction = await injector
        .get(TransactionsProvider)
        .transactionByIdLoader.load(transactionId);

      const currency = formatCurrency(transaction.currency);
      if (!isCryptoCurrency(currency)) {
        return null;
      }
      if (!transaction.debit_timestamp) {
        return null;
      }

      const { value } = await injector
        .get(CryptoExchangeProvider)
        .getCryptoExchangeRateLoader.load({
          cryptoCurrency: currency,
          date: transaction.debit_timestamp,
        });

      const rate = Number(value);

      return {
        from: currency,
        to: defaultCryptoConversionFiatCurrency,
        rate,
      };
    } catch (e) {
      const message = 'Error fetching transaction event date';
      console.error(message, e);
      throw new GraphQLError(message);
    }
  },
};
