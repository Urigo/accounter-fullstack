import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { IGetTransactionsByIdsResult } from '@modules/transactions/types.js';
import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import {
  Currency,
  type BusinessTripSummaryCategories,
  type BusinessTripSummaryRow,
} from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import type {
  currency,
  flight_class,
  IGetBusinessTripsAccommodationsTransactionsByBusinessTripIdsResult,
  IGetBusinessTripsFlightsTransactionsByBusinessTripIdsResult,
  IGetBusinessTripsOtherTransactionsByBusinessTripIdsResult,
  IGetBusinessTripsTransactionsByBusinessTripIdsResult,
  IGetBusinessTripsTravelAndSubsistenceTransactionsByBusinessTripIdsResult,
} from '../types.js';

export type SummaryCategoryData = { [key in currency]?: { total: number; taxable: number } };
export type SummaryData = Record<BusinessTripSummaryCategories, SummaryCategoryData>;
export type TripMetaData = {
  tripDuration: number;
  hasAccommodationExpenses: boolean;
  destination: string | null;
};

export function convertSummaryCategoryDataToRow(
  category: BusinessTripSummaryCategories,
  data: SummaryCategoryData,
): BusinessTripSummaryRow {
  return {
    type: category,
    totalForeignCurrencies: Object.entries(data)
      .filter(row => row[0] !== Currency.Ils)
      .map(([currency, { total }]) => formatFinancialAmount(total, currency)),
    taxableForeignCurrencies: Object.entries(data)
      .filter(row => row[0] !== Currency.Ils)
      .map(([currency, { taxable }]) => formatFinancialAmount(taxable, currency)),
    totalLocalCurrency: formatFinancialAmount(data[Currency.Ils]?.total ?? 0, Currency.Ils),
    taxableLocalCurrency: formatFinancialAmount(data[Currency.Ils]?.taxable ?? 0, Currency.Ils),
    excessExpenditure: formatFinancialAmount(0, Currency.Ils),
  };
}

export function calculateTotalReportSummaryCategory(data: Partial<SummaryData>) {
  const totalSumCategory = Object.values(data).reduce((acc, category) => {
    Object.entries(category).map(([currency, { total, taxable }]) => {
      acc[currency as Currency] ||= { total: 0, taxable: 0 };
      acc[currency as Currency]!.total += total;
      acc[currency as Currency]!.taxable += taxable;
    });
    return acc;
  }, {});
  return totalSumCategory;
}

function getTransactionCoreData(
  tripTransaction: IGetBusinessTripsTransactionsByBusinessTripIdsResult,
  transactions: IGetTransactionsByIdsResult[],
): {
  amount: number;
  currency: currency;
  date: Date;
} {
  if (tripTransaction.payed_by_employee) {
    if (!tripTransaction.currency || !tripTransaction.amount || !tripTransaction.date) {
      throw new GraphQLError(
        `Currency, amount or date not found for employee-paid trip transaction ID ${tripTransaction.id}`,
      );
    }
    return {
      amount: Number(tripTransaction.amount),
      currency: tripTransaction.currency,
      date: new Date(tripTransaction.date),
    };
  }
  const transaction = transactions.find(t => t.id === tripTransaction.transaction_id);
  if (!transaction) {
    throw new GraphQLError(`Transaction not found for trip transaction ID ${tripTransaction.id}`);
  }
  if (!transaction.currency || !transaction.amount || !transaction.debit_date) {
    throw new GraphQLError(
      `Currency, amount or date not found for transaction ID ${transaction.id}`,
    );
  }
  return {
    amount: Number(transaction.amount),
    currency: transaction.currency,
    date: new Date(transaction.debit_date),
  };
}

async function getLocalAmountAndExchangeRate(
  injector: Injector,
  currency: currency,
  amount: number,
  date: Date,
) {
  const exchangeRatePromise =
    currency === DEFAULT_LOCAL_CURRENCY
      ? Promise.resolve(1)
      : injector
          .get(ExchangeProvider)
          .getExchangeRates(currency as Currency, DEFAULT_LOCAL_CURRENCY, date);
  const usdRatePromise =
    currency === Currency.Usd
      ? Promise.resolve()
      : injector.get(ExchangeProvider).getExchangeRates(Currency.Usd, DEFAULT_LOCAL_CURRENCY, date);
  const [exchangeRate, usdRate] = await Promise.all([exchangeRatePromise, usdRatePromise]);
  const localAmount = exchangeRate * amount;
  return { localAmount, exchangeRate, foreignAmount: amount, usdRate: usdRate ?? exchangeRate };
}

async function getTransactionAmountsData(
  injector: Injector,
  businessTripTransaction: IGetBusinessTripsTransactionsByBusinessTripIdsResult,
  transactions: IGetTransactionsByIdsResult[],
) {
  const { amount, currency, date } = getTransactionCoreData(businessTripTransaction, transactions);
  const isForeign = currency !== DEFAULT_LOCAL_CURRENCY;

  const { localAmount, exchangeRate, foreignAmount, usdRate } = await getLocalAmountAndExchangeRate(
    injector,
    currency,
    amount,
    date,
  );

  return { currency, isForeign, localAmount, exchangeRate, foreignAmount, usdRate };
}

export async function flightTransactionDataCollector(
  injector: Injector,
  businessTripTransaction: IGetBusinessTripsFlightsTransactionsByBusinessTripIdsResult,
  partialSummaryData: Partial<SummaryData>,
  transactions: IGetTransactionsByIdsResult[],
): Promise<void> {
  // populate category
  partialSummaryData['FLIGHT'] ??= {};
  const category = partialSummaryData['FLIGHT'] as SummaryCategoryData;

  const { currency, isForeign, localAmount, exchangeRate, foreignAmount } =
    await getTransactionAmountsData(injector, businessTripTransaction, transactions);

  // populate currency
  category[DEFAULT_LOCAL_CURRENCY] ||= { total: 0, taxable: 0 };
  if (isForeign) {
    category[currency] ||= { total: 0, taxable: 0 };
  }

  // calculate taxable amount
  const fullyTaxableClasses: flight_class[] = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS'];
  if (!businessTripTransaction.class) {
    throw new GraphQLError(
      `Flight class not found for flight transaction ID ${businessTripTransaction.id}`,
    );
  }
  if (!fullyTaxableClasses.includes(businessTripTransaction.class)) {
    throw new GraphQLError(
      `Taxability logic for flight class ${businessTripTransaction.class} is not implemented yet (trip transaction ID: ${businessTripTransaction.id})`,
    );
  }

  // for all classes <= business, the amount is fully taxable
  const localTaxable = localAmount;

  // update amounts
  category[DEFAULT_LOCAL_CURRENCY].total += localAmount;
  category[DEFAULT_LOCAL_CURRENCY].taxable += localTaxable;
  if (isForeign) {
    category[currency]!.total += foreignAmount;
    category[currency]!.taxable += localTaxable / exchangeRate;
  }
}

export async function accommodationTransactionDataCollector(
  injector: Injector,
  businessTripTransaction: IGetBusinessTripsAccommodationsTransactionsByBusinessTripIdsResult,
  partialSummaryData: Partial<SummaryData>,
  transactions: IGetTransactionsByIdsResult[],
): Promise<void> {
  // populate category
  partialSummaryData['ACCOMMODATION'] ??= {};
  const category = partialSummaryData['ACCOMMODATION'] as SummaryCategoryData;

  const { currency, isForeign, localAmount, exchangeRate, foreignAmount, usdRate } =
    await getTransactionAmountsData(injector, businessTripTransaction, transactions);

  // populate currency
  category[DEFAULT_LOCAL_CURRENCY] ||= { total: 0, taxable: 0 };
  if (isForeign) {
    category[currency] ||= { total: 0, taxable: 0 };
  }

  if (!businessTripTransaction.nights_count) {
    throw new GraphQLError(
      `Nights count not found for accommodation trip transaction ID ${businessTripTransaction.id}`,
    );
  }
  if (!Number.isInteger(businessTripTransaction.nights_count)) {
    throw new GraphQLError(`Nights count must be an integer`);
  }

  // calculate taxable amount
  const maxTaxableUsd = accommodationMaxTaxableUSD(businessTripTransaction.nights_count);
  const isFullyTaxable = localAmount / exchangeRate >= maxTaxableUsd;

  const localTaxable = isFullyTaxable ? localAmount : maxTaxableUsd * usdRate;

  // update amounts
  category[DEFAULT_LOCAL_CURRENCY].total += localAmount;
  category[DEFAULT_LOCAL_CURRENCY].taxable += localTaxable;
  if (isForeign) {
    category[currency]!.total += foreignAmount;
    category[currency]!.taxable += localTaxable / exchangeRate;
  }
}

export async function otherTransactionsDataCollector(
  injector: Injector,
  travelAndSubsistenceTransactions: IGetBusinessTripsTravelAndSubsistenceTransactionsByBusinessTripIdsResult[],
  otherTransactions: IGetBusinessTripsOtherTransactionsByBusinessTripIdsResult[],
  partialSummaryData: Partial<SummaryData>,
  transactions: IGetTransactionsByIdsResult[],
  tripMetaData: TripMetaData,
): Promise<void> {
  // populate category
  partialSummaryData['OTHER'] ??= {};
  const category = partialSummaryData['OTHER'] as SummaryCategoryData;

  const { currency, isForeign, localAmount, exchangeRate, foreignAmount } =
    await getTransactionAmountsData(injector, businessTripTransaction, transactions);

  // populate currency
  category[DEFAULT_LOCAL_CURRENCY] ||= { total: 0, taxable: 0 };
  if (isForeign) {
    category[currency] ||= { total: 0, taxable: 0 };
  }

  // calculate taxable amount
  const localTaxable = _____;

  // update amounts
  category[DEFAULT_LOCAL_CURRENCY].total += localAmount;
  category[DEFAULT_LOCAL_CURRENCY].taxable += localTaxable;
  if (isForeign) {
    category[currency]!.total += foreignAmount;
    category[currency]!.taxable += localTaxable / exchangeRate;
  }
}

function accommodationMaxTaxableUSD(nights: number) {
  if (nights <= 7) {
    return nights * 335;
  }
  if (nights <= 90) {
    return 7 * 335 + (nights - 7) * 147;
  }

  throw new GraphQLError(`Taxability logic for more than 90 nights is not implemented yet`);
}
