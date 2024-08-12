import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import {
  Currency,
  type BusinessTripSummaryCategories,
  type BusinessTripSummaryRow,
} from '@shared/gql-types';
import { formatCurrency, formatFinancialAmount } from '@shared/helpers';
import type {
  flight_class,
  IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsResult,
  IGetBusinessTripsExpensesByBusinessTripIdsResult,
  IGetBusinessTripsFlightsExpensesByBusinessTripIdsResult,
} from '../types.js';

export type SummaryCategoryData = Partial<Record<Currency, { total: number; taxable: number }>>;
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

function getExpenseCoreData(tripExpense: IGetBusinessTripsExpensesByBusinessTripIdsResult): {
  amount: number;
  currency: Currency;
  date: Date;
} {
  if (tripExpense.payed_by_employee) {
    if (!tripExpense.currency || !tripExpense.amount || !tripExpense.date) {
      throw new GraphQLError(
        `Currency, amount or date not found for employee-paid trip expense ID ${tripExpense.id}`,
      );
    }
    return {
      amount: Number(tripExpense.amount),
      currency: formatCurrency(tripExpense.currency),
      date: new Date(tripExpense.date),
    };
  }
  if (!tripExpense.currency || !tripExpense.amount || !tripExpense.value_date) {
    throw new GraphQLError(
      `Currency, amount or date not found for business trip expense ID ${tripExpense.id}`,
    );
  }
  return {
    amount: Number(tripExpense.amount) * -1,
    currency: formatCurrency(tripExpense.currency),
    date: new Date(tripExpense.value_date),
  };
}

async function getLocalAmountAndExchangeRate(
  injector: Injector,
  currency: Currency,
  amount: number,
  date: Date,
) {
  const exchangeRatePromise =
    currency === DEFAULT_LOCAL_CURRENCY
      ? Promise.resolve(1)
      : injector.get(ExchangeProvider).getExchangeRates(currency, DEFAULT_LOCAL_CURRENCY, date);
  const usdRatePromise =
    currency === Currency.Usd
      ? Promise.resolve()
      : injector.get(ExchangeProvider).getExchangeRates(Currency.Usd, DEFAULT_LOCAL_CURRENCY, date);
  const [exchangeRate, usdRate] = await Promise.all([exchangeRatePromise, usdRatePromise]);
  const localAmount = exchangeRate * amount;
  return { localAmount, exchangeRate, foreignAmount: amount, usdRate: usdRate ?? exchangeRate };
}

async function getExpenseAmountsData(
  injector: Injector,
  businessTripExpense: IGetBusinessTripsExpensesByBusinessTripIdsResult,
) {
  const { amount, currency, date } = getExpenseCoreData(businessTripExpense);
  const isForeign = currency !== DEFAULT_LOCAL_CURRENCY;

  const { localAmount, exchangeRate, foreignAmount, usdRate } = await getLocalAmountAndExchangeRate(
    injector,
    currency,
    amount,
    date,
  );

  return { currency, isForeign, localAmount, exchangeRate, foreignAmount, usdRate };
}

export async function flightExpenseDataCollector(
  injector: Injector,
  businessTripExpense: IGetBusinessTripsFlightsExpensesByBusinessTripIdsResult,
  partialSummaryData: Partial<SummaryData>,
): Promise<string | void> {
  // populate category
  partialSummaryData['FLIGHT'] ??= {};
  const category = partialSummaryData['FLIGHT'] as SummaryCategoryData;

  const { currency, isForeign, localAmount, exchangeRate, foreignAmount } =
    await getExpenseAmountsData(injector, businessTripExpense);

  // calculate taxable amount
  const fullyTaxableClasses: flight_class[] = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS'];
  if (!businessTripExpense.class) {
    console.error(`Flight class not found for flight expense ID ${businessTripExpense.id}`);
    return 'Flights expenses: some flights are missing class';
  }
  if (!fullyTaxableClasses.includes(businessTripExpense.class)) {
    console.error(
      `Taxability logic for flight class ${businessTripExpense.class} is not implemented yet (trip expense ID: ${businessTripExpense.id})`,
    );
    return `Flights expenses: taxability logic for class ${businessTripExpense.class} is not implemented yet`;
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

export async function accommodationExpenseDataCollector(
  injector: Injector,
  businessTripExpense: IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsResult,
  partialSummaryData: Partial<SummaryData>,
  destination: string | null,
): Promise<string | void> {
  // populate category
  partialSummaryData['ACCOMMODATION'] ??= {};
  const category = partialSummaryData['ACCOMMODATION'] as SummaryCategoryData;

  const { currency, isForeign, localAmount, exchangeRate, foreignAmount, usdRate } =
    await getExpenseAmountsData(injector, businessTripExpense);

  if (!businessTripExpense.nights_count) {
    console.error(
      `Nights count not found for accommodation trip expense ID ${businessTripExpense.id}`,
    );
    return 'Accommodation expenses: some expenses are missing nights count';
  }
  if (!Number.isInteger(businessTripExpense.nights_count)) {
    console.error(`Nights count must be an integer`);
    return 'Accommodation expenses: nights count must be an integer';
  }

  // calculate taxable amount
  const maxTaxableUsd = accommodationMaxTaxableUSD(businessTripExpense.nights_count, destination);
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

export async function otherExpensesDataCollector(
  injector: Injector,
  otherExpenses: IGetBusinessTripsExpensesByBusinessTripIdsResult[],
  partialSummaryData: Partial<SummaryData>,
  tripMetaData: TripMetaData,
): Promise<string | void> {
  if (otherExpenses.length === 0) {
    return void 0;
  }

  // populate category
  partialSummaryData['OTHER'] ??= {};
  const category = partialSummaryData['OTHER'] as SummaryCategoryData;

  const [usdRate, ...expensesAmountData] = await Promise.all([
    injector
      .get(ExchangeProvider)
      .getExchangeRates(Currency.Usd, DEFAULT_LOCAL_CURRENCY, tripMetaData.endDate),
    ...otherExpenses.map(businessTripExpense =>
      getExpenseAmountsData(injector, businessTripExpense),
    ),
  ]);

  const dailyTaxableLimit = tripMetaData.hasAccommodationExpenses ? 94 : 147;
  const increasedLimitDestination = isIncreasedLimitDestination(tripMetaData.destination)
    ? 1.25
    : 1;
  const maxTaxableUsd = dailyTaxableLimit * tripMetaData.tripDuration * increasedLimitDestination;
  const maxTaxableLocal = maxTaxableUsd * usdRate;

  const totalAmountLocal = expensesAmountData.reduce(
    (sum, expenseData) => sum + expenseData.localAmount,
    0,
  );

  if (totalAmountLocal > maxTaxableLocal) {
    category[DEFAULT_LOCAL_CURRENCY] ||= { total: 0, taxable: 0 };
    category[DEFAULT_LOCAL_CURRENCY].total += totalAmountLocal;
    category[DEFAULT_LOCAL_CURRENCY].taxable += maxTaxableLocal;
  } else {
    expensesAmountData.map(({ isForeign, localAmount, foreignAmount, exchangeRate, currency }) => {
      // update amounts
      category[DEFAULT_LOCAL_CURRENCY] ||= { total: 0, taxable: 0 };
      category[DEFAULT_LOCAL_CURRENCY].total += localAmount;
      category[DEFAULT_LOCAL_CURRENCY].taxable += localAmount;
      if (isForeign) {
        category[currency] ||= { total: 0, taxable: 0 };
        category[currency]!.total += foreignAmount;
        category[currency]!.taxable += localAmount / exchangeRate;
      }
    });
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
