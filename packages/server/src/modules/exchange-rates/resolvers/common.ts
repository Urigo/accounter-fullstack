import { format } from 'date-fns';
import { DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY } from '@shared/constants';
import { formatCurrency } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import { isCryptoCurrency } from '../helpers/exchange.helper.js';
import { CryptoExchangeProvider } from '../providers/crypto-exchange.provider.js';
import { ExchangeRatesModule } from '../types.js';

export const commonTransactionFields:
  | ExchangeRatesModule.ConversionTransactionResolvers
  | ExchangeRatesModule.FeeTransactionResolvers
  | ExchangeRatesModule.WireTransactionResolvers
  | ExchangeRatesModule.CommonTransactionResolvers = {
  debitExchangeRates: DbTransaction => {
    if (!DbTransaction.debit_date) {
      return null;
    }
    return format(DbTransaction.debit_date, 'yyyy-MM-dd') as TimelessDateString;
  },
  eventExchangeRates: DbTransaction => {
    if (!DbTransaction.event_date) {
      return null;
    }
    return format(DbTransaction.event_date, 'yyyy-MM-dd') as TimelessDateString;
  },
  cryptoExchangeRate: async (DbTransaction, _, { injector }) => {
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
      to: DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY,
      rate,
    };
  },
};

export const commonChargeFields: ExchangeRatesModule.ChargeResolvers = {
  exchangeRates: DbCharge => {
    const ratesDate = DbCharge.transactions_min_debit_date || DbCharge.documents_min_date;

    if (!ratesDate) {
      return null;
    }

    return format(ratesDate, 'yyyy-MM-dd') as TimelessDateString;
  },
};
