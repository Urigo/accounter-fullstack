import { dateToTimelessDateString, formatCurrency } from '@shared/helpers';
import { isCryptoCurrency } from '../helpers/exchange.helper.js';
import { CryptoExchangeProvider } from '../providers/crypto-exchange.provider.js';
import { ExchangeRatesModule } from '../types.js';

export const commonTransactionFields:
  | ExchangeRatesModule.ConversionTransactionResolvers
  | ExchangeRatesModule.CommonTransactionResolvers = {
  debitExchangeRates: DbTransaction => {
    if (!DbTransaction.debit_date) {
      return null;
    }
    return dateToTimelessDateString(DbTransaction.debit_date);
  },
  eventExchangeRates: DbTransaction => {
    if (!DbTransaction.event_date) {
      return null;
    }
    return dateToTimelessDateString(DbTransaction.event_date);
  },
  cryptoExchangeRate: async (
    DbTransaction,
    _,
    { injector, adminContext: { defaultCryptoConversionFiatCurrency } },
  ) => {
    const currency = formatCurrency(DbTransaction.currency);
    if (!isCryptoCurrency(currency) || !DbTransaction.debit_timestamp) {
      return null;
    }

    const { value } = await injector.get(CryptoExchangeProvider).getCryptoExchangeRateLoader.load({
      cryptoCurrency: currency,
      date: DbTransaction.debit_timestamp,
    });

    const rate = Number(value);

    return {
      from: currency,
      to: defaultCryptoConversionFiatCurrency,
      rate,
    };
  },
};

export const commonChargeFields: ExchangeRatesModule.ChargeResolvers = {
  exchangeRates: DbCharge => {
    const ratesDate =
      DbCharge.transactions_min_debit_date ||
      DbCharge.documents_min_date ||
      DbCharge.ledger_min_invoice_date;

    if (!ratesDate) {
      return null;
    }

    return dateToTimelessDateString(ratesDate);
  },
};
