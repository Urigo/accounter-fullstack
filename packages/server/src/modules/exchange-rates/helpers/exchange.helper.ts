import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import type { IGetTransactionsByIdsResult } from '@modules/transactions/types.js';
import { Currency } from '../../../shared/enums.js';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import { NoOptionalField, TimelessDateString } from '../../../shared/types/index.js';
import { FiatExchangeProvider } from '../providers/fiat-exchange.provider.js';
import type { IGetExchangeRatesByDatesResult } from '../types.js';

type ValidatedTransaction = NoOptionalField<IGetTransactionsByIdsResult, 'debit_date'>;

export function defineConversionBaseAndQuote(transactions: Array<IGetTransactionsByIdsResult>) {
  if (transactions.length < 2) {
    throw new GraphQLError('Conversion charges must have at least two ledger records');
  }

  let baseTransaction: ValidatedTransaction | undefined = undefined;
  let quoteTransaction: ValidatedTransaction | undefined = undefined;
  const miscTransactions: ValidatedTransaction[] = [];

  for (const transaction of transactions) {
    if (transaction.is_fee || transaction.source_description?.includes('Fee:')) {
      miscTransactions.push(transaction as ValidatedTransaction);
      continue;
    }

    if (!transaction.debit_date) {
      throw new GraphQLError(`Transaction ID="${transaction.id}" is missing debit date`);
    }

    if (Number(transaction.amount) > 0) {
      if (quoteTransaction) {
        throw new GraphQLError('Conversion charges must have only one quote transaction');
      }
      quoteTransaction = transaction as ValidatedTransaction;
    } else {
      if (baseTransaction) {
        throw new GraphQLError('Conversion charges must have only one base transaction');
      }
      baseTransaction = transaction as ValidatedTransaction;
    }
  }

  if (!baseTransaction || !quoteTransaction) {
    throw new GraphQLError('Conversion charges must have a base and a quote transactions');
  }

  if (baseTransaction.debit_date.getTime() !== quoteTransaction.debit_date.getTime()) {
    throw new GraphQLError('Conversion transactions must have matching value dates');
  }

  return { baseTransaction, quoteTransaction, miscTransactions };
}

export function getRateForCurrency(
  currencyCode: Currency,
  exchangeRates: IGetExchangeRatesByDatesResult,
  defaultLocalCurrency: Currency,
) {
  if (currencyCode === defaultLocalCurrency) {
    return 1;
  }
  if (
    currencyCode &&
    [
      Currency.Usd,
      Currency.Eur,
      Currency.Gbp,
      Currency.Cad,
      Currency.Jpy,
      Currency.Aud,
      Currency.Sek,
    ].includes(currencyCode)
  ) {
    const currencyKey = currencyCode.toLowerCase() as
      | 'usd'
      | 'eur'
      | 'gbp'
      | 'cad'
      | 'jpy'
      | 'aud'
      | 'sek';
    const rate = parseFloat(exchangeRates[currencyKey] ?? '');
    if (Number.isNaN(rate)) {
      throw new Error(
        `Exchange rates for date ${exchangeRates.exchange_date}, currency ${currencyCode} not found`,
      );
    }
    return rate;
  }

  throw new Error(`New account currency ${currencyCode}`);
}

export function getClosestRateForDate(
  date: string | Date,
  rates: Array<IGetExchangeRatesByDatesResult>,
) {
  const sortedRates = rates.sort((a, b) => {
    return (b.exchange_date?.getTime() ?? 0) - (a.exchange_date?.getTime() ?? 0);
  });

  const stringifiedDate = dateToTimelessDateString(new Date(date));

  const exchangeRate = sortedRates.find(
    rate => dateToTimelessDateString(rate.exchange_date!) <= stringifiedDate,
  );

  if (!exchangeRate) {
    throw new Error(`No exchange rate for date ${stringifiedDate}`);
  }
  return exchangeRate;
}

export function isCryptoCurrency(currency: Currency) {
  return currency === Currency.Grt || currency === Currency.Usdc || currency === Currency.Eth;
}

export async function getFiatExchangeRate(
  injector: Injector,
  timelessDate: TimelessDateString,
  currency: keyof Omit<IGetExchangeRatesByDatesResult, 'exchange_date'>,
) {
  const exchangeRates = await injector
    .get(FiatExchangeProvider)
    .getExchangeRatesByDatesLoader.load(new Date(timelessDate));
  if (!exchangeRates?.[currency]) {
    return null;
  }
  return parseFloat(exchangeRates[currency]);
}
