import { format } from 'date-fns';
import { TimelessDateString } from '@shared/types';
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
};
