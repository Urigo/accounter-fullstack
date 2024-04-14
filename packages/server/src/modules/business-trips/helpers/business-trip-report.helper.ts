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
  // IGetBusinessTripsOtherTransactionsByBusinessTripIdsResult,
  IGetBusinessTripsTransactionsByBusinessTripIdsResult,
  // IGetBusinessTripsTravelAndSubsistenceTransactionsByBusinessTripIdsResult,
} from '../types.js';

export type SummaryCategoryData = { [key in currency]?: { total: number; taxable: number } };
export type SummaryData = Record<BusinessTripSummaryCategories, SummaryCategoryData>;
export type TripMetaData = {
  tripDuration: number;
  hasAccommodationExpenses: boolean;
  destination: string | null;
  endDate: Date;
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
    amount: Number(transaction.amount) * -1,
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
): Promise<string | void> {
  // populate category
  partialSummaryData['FLIGHT'] ??= {};
  const category = partialSummaryData['FLIGHT'] as SummaryCategoryData;

  const { currency, isForeign, localAmount, exchangeRate, foreignAmount } =
    await getTransactionAmountsData(injector, businessTripTransaction, transactions);

  // calculate taxable amount
  const fullyTaxableClasses: flight_class[] = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS'];
  if (!businessTripTransaction.class) {
    console.error(`Flight class not found for flight transaction ID ${businessTripTransaction.id}`);
    return 'Flights transactions: some transactions are missing class';
  }
  if (!fullyTaxableClasses.includes(businessTripTransaction.class)) {
    console.error(
      `Taxability logic for flight class ${businessTripTransaction.class} is not implemented yet (trip transaction ID: ${businessTripTransaction.id})`,
    );
    return `Flights transactions: taxability logic for class ${businessTripTransaction.class} is not implemented yet`;
  }

  // for all classes <= business, the amount is fully taxable
  const localTaxable = localAmount;

  // update amounts
  category[DEFAULT_LOCAL_CURRENCY] ||= { total: 0, taxable: 0 };
  category[DEFAULT_LOCAL_CURRENCY].total += localAmount;
  category[DEFAULT_LOCAL_CURRENCY].taxable += localTaxable;
  if (isForeign) {
    category[currency] ||= { total: 0, taxable: 0 };
    category[currency]!.total += foreignAmount;
    category[currency]!.taxable += localTaxable / exchangeRate;
  }

  return void 0;
}

export async function accommodationTransactionDataCollector(
  injector: Injector,
  businessTripTransaction: IGetBusinessTripsAccommodationsTransactionsByBusinessTripIdsResult,
  partialSummaryData: Partial<SummaryData>,
  transactions: IGetTransactionsByIdsResult[],
  destination: string | null,
): Promise<string | void> {
  // populate category
  partialSummaryData['ACCOMMODATION'] ??= {};
  const category = partialSummaryData['ACCOMMODATION'] as SummaryCategoryData;

  const { currency, isForeign, localAmount, exchangeRate, foreignAmount, usdRate } =
    await getTransactionAmountsData(injector, businessTripTransaction, transactions);

  if (!businessTripTransaction.nights_count) {
    console.error(
      `Nights count not found for accommodation trip transaction ID ${businessTripTransaction.id}`,
    );
    return 'Accommodation transactions: some transactions are missing nights count';
  }
  if (!Number.isInteger(businessTripTransaction.nights_count)) {
    console.error(`Nights count must be an integer`);
    return 'Accommodation transactions: nights count must be an integer';
  }

  // calculate taxable amount
  const maxTaxableUsd = accommodationMaxTaxableUSD(
    businessTripTransaction.nights_count,
    destination,
  );
  const isFullyTaxable = localAmount / exchangeRate >= maxTaxableUsd;

  const localTaxable = isFullyTaxable ? localAmount : maxTaxableUsd * usdRate;
  const foreignTaxable = isFullyTaxable ? foreignAmount : maxTaxableUsd;

  // update amounts
  category[DEFAULT_LOCAL_CURRENCY] ||= { total: 0, taxable: 0 };
  category[DEFAULT_LOCAL_CURRENCY].total += localAmount;
  category[DEFAULT_LOCAL_CURRENCY].taxable += localTaxable;
  if (isForeign) {
    category[currency] ||= { total: 0, taxable: 0 };
    category[currency]!.total += foreignAmount;
    category[currency]!.taxable += foreignTaxable;
  }

  return void 0;
}

export async function otherTransactionsDataCollector(
  injector: Injector,
  otherTransactions: IGetBusinessTripsTransactionsByBusinessTripIdsResult[],
  partialSummaryData: Partial<SummaryData>,
  transactions: IGetTransactionsByIdsResult[],
  tripMetaData: TripMetaData,
): Promise<string | void> {
  if (otherTransactions.length === 0) {
    return void 0;
  }

  // populate category
  partialSummaryData['OTHER'] ??= {};
  const category = partialSummaryData['OTHER'] as SummaryCategoryData;

  const [usdRate, ...transactionsAmountData] = await Promise.all([
    injector
      .get(ExchangeProvider)
      .getExchangeRates(Currency.Usd, DEFAULT_LOCAL_CURRENCY, tripMetaData.endDate),
    ...otherTransactions.map(businessTripTransaction =>
      getTransactionAmountsData(injector, businessTripTransaction, transactions),
    ),
  ]);

  const dailyTaxableLimit = tripMetaData.hasAccommodationExpenses ? 94 : 147;
  const increasedLimitDestination = isIncreasedLimitDestination(tripMetaData.destination)
    ? 1.25
    : 1;
  const maxTaxableUsd = dailyTaxableLimit * tripMetaData.tripDuration * increasedLimitDestination;
  const maxTaxableLocal = maxTaxableUsd * usdRate;

  const totalAmountLocal = transactionsAmountData.reduce(
    (sum, transactionData) => sum + transactionData.localAmount,
    0,
  );

  if (totalAmountLocal > maxTaxableLocal) {
    category[DEFAULT_LOCAL_CURRENCY] ||= { total: 0, taxable: 0 };
    category[DEFAULT_LOCAL_CURRENCY].total += totalAmountLocal;
    category[DEFAULT_LOCAL_CURRENCY].taxable += maxTaxableLocal;
  } else {
    transactionsAmountData.map(
      ({ isForeign, localAmount, foreignAmount, exchangeRate, currency }) => {
        // update amounts
        category[DEFAULT_LOCAL_CURRENCY] ||= { total: 0, taxable: 0 };
        category[DEFAULT_LOCAL_CURRENCY].total += localAmount;
        category[DEFAULT_LOCAL_CURRENCY].taxable += localAmount;
        if (isForeign) {
          category[currency] ||= { total: 0, taxable: 0 };
          category[currency]!.total += foreignAmount;
          category[currency]!.taxable += localAmount / exchangeRate;
        }
      },
    );
  }

  return void 0;
}

function isIncreasedLimitDestination(destination: string | null) {
  if (!destination) {
    return false;
  }
  const increasedLimitDestinations = [
    'australia',
    'austria',
    'italy',
    'iceland',
    'ireland',
    'angola',
    'belgium',
    'germany',
    'dubai',
    'denmark',
    'netherlands',
    'hong kong',
    'united kingdom',
    'taiwan',
    'greece',
    'japan',
    'luxembourg',
    'norway',
    'spain',
    'oman',
    'finland',
    'france',
    'qatar',
    'korea',
    'cameroon ',
    'canada',
    'sweden',
    'switzerland',
  ];
  return increasedLimitDestinations.includes(destination.toLowerCase());
}

function accommodationMaxTaxableUSD(nights: number, destination: string | null) {
  const increasedLimitDestination = isIncreasedLimitDestination(destination) ? 1.25 : 1;
  if (nights <= 7) {
    return nights * 335 * increasedLimitDestination;
  }
  if (nights <= 90) {
    return 7 * 335 + (nights - 7) * 147 * increasedLimitDestination;
  }

  throw new GraphQLError(`Taxability logic for more than 90 nights is not implemented yet`);
}

export function onlyUnique(value: string, index: number, array: string[]) {
  return array.indexOf(value) === index;
}
