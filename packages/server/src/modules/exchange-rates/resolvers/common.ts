import { GraphQLError } from 'graphql';
import { getDocumentsMinDate } from '@modules/documents/helpers/dates.helper.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { getLedgerMinInvoiceDate } from '@modules/ledger/helpers/dates.helper.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { getTransactionsMinDebitDate } from '@modules/transactions/helpers/debit-date.helper.js';
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

export const commonChargeFields: ExchangeRatesModule.ChargeResolvers = {
  exchangeRates: async (chargeId, _, { injector }) => {
    const [transactions, documents, ledgerRecords] = await Promise.all([
      injector.get(TransactionsProvider).transactionsByChargeIDLoader.load(chargeId),
      injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(chargeId),
      injector.get(LedgerProvider).getLedgerRecordsByChargesIdLoader.load(chargeId),
    ]);

    const ratesDate =
      getTransactionsMinDebitDate(transactions) ||
      getDocumentsMinDate(documents) ||
      getLedgerMinInvoiceDate(ledgerRecords);

    if (!ratesDate) {
      return null;
    }

    return dateToTimelessDateString(ratesDate);
  },
};
