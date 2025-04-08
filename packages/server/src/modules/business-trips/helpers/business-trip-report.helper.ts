import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { getTransactionDebitDate } from '@modules/transactions/helpers/debit-date.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { IGetTransactionsByIdsResult } from '@modules/transactions/types.js';
import {
  Currency,
  type BusinessTripSummaryCategories,
  type BusinessTripSummaryRow,
} from '@shared/gql-types';
import { formatCurrency, formatFinancialAmount } from '@shared/helpers';
import { BusinessTripError } from '../resolvers/business-trip-summary.resolver.js';
import type {
  flight_class,
  IGetAllTaxVariablesResult,
  IGetBusinessTripsCarRentalExpensesByBusinessTripIdsResult,
  IGetBusinessTripsExpensesByBusinessTripIdsResult,
  IGetBusinessTripsFlightsExpensesByBusinessTripIdsResult,
  IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsResult,
} from '../types.js';

export type SummaryCategoryData = Partial<
  Record<Currency, { total: number; taxable: number; maxTaxable: number }>
>;
export type SummaryData = Record<BusinessTripSummaryCategories, SummaryCategoryData>;
export type AttendeeInfo = {
  name: string;
  arrival: Date | null;
  departure: Date | null;
  daysCount: number;
  nightsCount: number;
};

export function convertSummaryCategoryDataToRow(
  category: BusinessTripSummaryCategories,
  data: SummaryCategoryData,
): BusinessTripSummaryRow {
  const excessExpenditure = (data[Currency.Ils]?.taxable ?? 0) - (data[Currency.Ils]?.total ?? 0);
  return {
    type: category,
    totalForeignCurrency: formatFinancialAmount(data[Currency.Usd]?.total ?? 0, Currency.Usd),
    taxableForeignCurrency: formatFinancialAmount(data[Currency.Usd]?.taxable ?? 0, Currency.Usd),
    maxTaxableForeignCurrency: formatFinancialAmount(
      data[Currency.Usd]?.maxTaxable ?? 0,
      Currency.Usd,
    ),
    totalLocalCurrency: formatFinancialAmount(data[Currency.Ils]?.total ?? 0, Currency.Ils),
    taxableLocalCurrency: formatFinancialAmount(data[Currency.Ils]?.taxable ?? 0, Currency.Ils),
    maxTaxableLocalCurrency: formatFinancialAmount(
      data[Currency.Ils]?.maxTaxable ?? 0,
      Currency.Ils,
    ),
    excessExpenditure: formatFinancialAmount(Math.max(excessExpenditure, 0), Currency.Ils),
  };
}

export function calculateTotalReportSummaryCategory(data: Partial<SummaryData>) {
  const totalSumCategory = Object.values(data).reduce((acc, category) => {
    Object.entries(category).map(([currency, { total, taxable }]) => {
      acc[currency as 'ILS' | 'USD'] ||= { total: 0, taxable: 0, maxTaxable: 0 };
      acc[currency as 'ILS' | 'USD']!.total += total;
      acc[currency as 'ILS' | 'USD']!.taxable += taxable;
    });
    return acc;
  }, {});
  return totalSumCategory;
}

export function getExpenseCoreData(
  tripExpense: Pick<
    IGetBusinessTripsExpensesByBusinessTripIdsResult,
    'payed_by_employee' | 'amount' | 'date' | 'currency' | 'value_date' | 'id'
  >,
): {
  amount: number;
  currency: Currency;
  date: Date;
} {
  if (tripExpense.payed_by_employee) {
    if (!tripExpense.currency || !tripExpense.amount || !tripExpense.date) {
      throw new BusinessTripError(
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
    throw new BusinessTripError(
      `Currency, amount or date not found for business trip expense ID ${tripExpense.id}`,
    );
  }
  return {
    amount: Number(tripExpense.amount),
    currency: formatCurrency(tripExpense.currency),
    date: new Date(tripExpense.value_date),
  };
}

async function getDefaultCurrenciesAmountsAndExchangeRate(
  context: GraphQLModules.Context,
  currency: Currency,
  amount: number,
  date: Date,
) {
  const {
    injector,
    adminContext: { defaultLocalCurrency, defaultCryptoConversionFiatCurrency },
  } = context;
  const exchangeRatePromise =
    currency === defaultLocalCurrency
      ? Promise.resolve(1)
      : injector.get(ExchangeProvider).getExchangeRates(currency, defaultLocalCurrency, date);
  const usdRatePromise =
    currency === defaultCryptoConversionFiatCurrency
      ? Promise.resolve(1)
      : injector
          .get(ExchangeProvider)
          .getExchangeRates(currency, defaultCryptoConversionFiatCurrency, date);
  const [localRate, foreignRate] = await Promise.all([exchangeRatePromise, usdRatePromise]);
  const localAmount = localRate * amount;
  const foreignAmount = foreignRate * amount;
  return { localAmount, foreignAmount };
}

export async function getExpenseAmountsData(
  context: GraphQLModules.Context,
  businessTripExpense: IGetBusinessTripsExpensesByBusinessTripIdsResult,
) {
  const { injector } = context;
  try {
    const { amount, currency, date } = getExpenseCoreData(businessTripExpense);

    const { localAmount, foreignAmount } = await getDefaultCurrenciesAmountsAndExchangeRate(
      context,
      currency,
      amount,
      date,
    );

    return { localAmount, foreignAmount };
  } catch (error) {
    // handle merged transaction of different currencies
    if (
      !(error instanceof Error) ||
      !error?.message?.includes('Currency, amount or date not found for business trip expense') ||
      !businessTripExpense.transaction_ids ||
      businessTripExpense.transaction_ids.length <= 1
    ) {
      throw error;
    }

    const transactions = await injector
      .get(TransactionsProvider)
      .transactionByIdLoader.loadMany(businessTripExpense.transaction_ids);

    const allTransactions = transactions.filter(
      transaction => transaction && !(transaction instanceof Error),
    ) as IGetTransactionsByIdsResult[];

    let localAmount = 0;
    let foreignAmount = 0;

    await Promise.all(
      allTransactions.map(async transaction => {
        if (!transaction || transaction instanceof Error) {
          return;
        }
        const amount = Number(transaction.amount);
        const currency = transaction.currency as Currency;
        const date = getTransactionDebitDate(transaction);

        if (!amount || !currency || !date) {
          const errorMessage = `Currency, amount or date not found for transaction ID ${transaction.id}`;
          console.error(errorMessage);
          throw new BusinessTripError(errorMessage);
        }

        const { localAmount: transactionLocalAmount, foreignAmount: transactionForeignAmount } =
          await getDefaultCurrenciesAmountsAndExchangeRate(context, currency, amount, date);

        localAmount += transactionLocalAmount;
        foreignAmount += transactionForeignAmount;
      }),
    );

    return { localAmount, foreignAmount };
  }
}

export async function flightExpenseDataCollector(
  context: GraphQLModules.Context,
  businessTripExpense: IGetBusinessTripsFlightsExpensesByBusinessTripIdsResult,
  partialSummaryData: Partial<SummaryData>,
): Promise<void> {
  // populate category
  partialSummaryData['FLIGHT'] ??= {};
  const category = partialSummaryData['FLIGHT'] as SummaryCategoryData;

  const { localAmount, foreignAmount } = await getExpenseAmountsData(context, businessTripExpense);

  // calculate taxable amount
  const fullyTaxableClasses: flight_class[] = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS'];
  if (!businessTripExpense.class) {
    console.error(`Flight class not found for flight expense ID ${businessTripExpense.id}`);
    throw new BusinessTripError('Flights expenses: some flights are missing class');
  }
  if (!fullyTaxableClasses.includes(businessTripExpense.class)) {
    console.error(
      `Taxability logic for flight class ${businessTripExpense.class} is not implemented yet (trip expense ID: ${businessTripExpense.id})`,
    );
    throw new BusinessTripError(
      `Flights expenses: taxability logic for class ${businessTripExpense.class} is not implemented yet`,
    );
  }

  // for all classes <= business, the amount is fully taxable
  const localTaxable = localAmount;
  const foreignTaxable = foreignAmount;

  // update amounts
  const { defaultLocalCurrency, defaultCryptoConversionFiatCurrency } = context.adminContext;
  category[defaultLocalCurrency] ||= { total: 0, taxable: 0, maxTaxable: 0 };
  category[defaultLocalCurrency].total += localAmount;
  category[defaultLocalCurrency].taxable += localTaxable;
  category[defaultLocalCurrency].maxTaxable += localTaxable;
  category[defaultCryptoConversionFiatCurrency] ||= { total: 0, taxable: 0, maxTaxable: 0 };
  category[defaultCryptoConversionFiatCurrency].total += foreignAmount;
  category[defaultCryptoConversionFiatCurrency].taxable += foreignTaxable;
  category[defaultCryptoConversionFiatCurrency].maxTaxable += foreignTaxable;

  return void 0;
}

export async function employeeAccommodationDataByTrip() {}

export async function otherExpensesDataCollector(
  context: GraphQLModules.Context,
  otherExpenses: IGetBusinessTripsExpensesByBusinessTripIdsResult[],
  partialSummaryData: Partial<SummaryData>,
): Promise<string | void> {
  const { defaultLocalCurrency, defaultCryptoConversionFiatCurrency } = context.adminContext;
  // populate category
  partialSummaryData['OTHER'] ??= {};
  const category = partialSummaryData['OTHER'] as SummaryCategoryData;
  category[defaultLocalCurrency] ||= { total: 0, taxable: 0, maxTaxable: 0 };
  category[defaultCryptoConversionFiatCurrency] ||= { total: 0, taxable: 0, maxTaxable: 0 };

  if (otherExpenses.length === 0) {
    return void 0;
  }

  await Promise.all(
    otherExpenses.map(async businessTripExpense => {
      const { localAmount, foreignAmount } = await getExpenseAmountsData(
        context,
        businessTripExpense,
      );

      category[defaultLocalCurrency]!.total += localAmount;
      category[defaultLocalCurrency]!.taxable += localAmount;
      category[defaultLocalCurrency]!.maxTaxable += localAmount;
      category[defaultCryptoConversionFiatCurrency]!.total += foreignAmount;
      category[defaultCryptoConversionFiatCurrency]!.taxable += foreignAmount;
      category[defaultCryptoConversionFiatCurrency]!.maxTaxable += foreignAmount;
    }),
  );

  return void 0;
}

type ReportMetaData = {
  destinationCode: string | null;
  unAccommodatedDays: number;
  attendees: Map<string, AttendeeInfo>;
};

export async function travelAndSubsistenceExpensesDataCollector(
  context: GraphQLModules.Context,
  businessTripExpenses: IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsResult[],
  partialSummaryData: Partial<SummaryData>,
  taxVariables: IGetAllTaxVariablesResult,
  { destinationCode, unAccommodatedDays, attendees }: ReportMetaData,
): Promise<void> {
  const { defaultLocalCurrency, defaultCryptoConversionFiatCurrency } = context.adminContext;
  // populate category
  partialSummaryData['TRAVEL_AND_SUBSISTENCE'] ??= {};
  const category = partialSummaryData['TRAVEL_AND_SUBSISTENCE'] as SummaryCategoryData;
  category[defaultLocalCurrency] ||= { total: 0, taxable: 0, maxTaxable: 0 };
  category[defaultCryptoConversionFiatCurrency] ||= { total: 0, taxable: 0, maxTaxable: 0 };

  const totalBusinessDays = Array.from(attendees.values()).reduce(
    (acc, attendee) => acc + attendee.daysCount,
    0,
  );

  const maxTaxableUsd = getAttendeeTravelAndSubsistenceMaxTax(
    totalBusinessDays,
    unAccommodatedDays,
    destinationCode,
    taxVariables,
  );

  category[defaultLocalCurrency].maxTaxable += 0; // TODO: calculate
  category[defaultCryptoConversionFiatCurrency].maxTaxable += maxTaxableUsd;

  // set actual expense amounts
  await Promise.all(
    businessTripExpenses.map(async businessTripExpense => {
      const { localAmount, foreignAmount } = await getExpenseAmountsData(
        context,
        businessTripExpense,
      );

      category[defaultLocalCurrency]!.total += localAmount;
      category[defaultCryptoConversionFiatCurrency]!.total += foreignAmount;
    }),
  );

  // set taxable amounts
  const taxableAmount = Math.max(
    category[defaultCryptoConversionFiatCurrency].total,
    maxTaxableUsd,
  );
  const taxablePortion =
    category[defaultCryptoConversionFiatCurrency].total === 0
      ? 0
      : taxableAmount / category[defaultCryptoConversionFiatCurrency].total;

  category[defaultLocalCurrency].taxable += category[defaultLocalCurrency].total * taxablePortion;
  category[defaultCryptoConversionFiatCurrency].taxable += taxableAmount;

  return void 0;
}

export async function carRentalExpensesDataCollector(
  context: GraphQLModules.Context,
  businessTripExpenses: IGetBusinessTripsCarRentalExpensesByBusinessTripIdsResult[],
  partialSummaryData: Partial<SummaryData>,
  taxVariables: IGetAllTaxVariablesResult,
  destinationCode: string | null,
): Promise<void> {
  const { defaultLocalCurrency, defaultCryptoConversionFiatCurrency } = context.adminContext;
  // populate category
  partialSummaryData['CAR_RENTAL'] ??= {};
  const category = partialSummaryData['CAR_RENTAL'] as SummaryCategoryData;
  category[defaultLocalCurrency] ||= { total: 0, taxable: 0, maxTaxable: 0 };
  category[defaultCryptoConversionFiatCurrency] ||= { total: 0, taxable: 0, maxTaxable: 0 };

  let rentalDays = 0;

  // set actual expense amounts
  await Promise.all(
    businessTripExpenses.map(async businessTripExpense => {
      if (!businessTripExpense.is_fuel_expense) {
        rentalDays += businessTripExpense.days;
      }

      const { localAmount, foreignAmount } = await getExpenseAmountsData(
        context,
        businessTripExpense,
      );

      category[defaultLocalCurrency]!.total += localAmount;
      category[defaultCryptoConversionFiatCurrency]!.total += foreignAmount;
    }),
  );

  // set max taxable amounts
  const { max_car_rental_per_day } = taxVariables;
  const maxDailyRentalAmount = Number(max_car_rental_per_day);

  if (Number.isNaN(maxDailyRentalAmount)) {
    throw new BusinessTripError('Tax variables are not set');
  }

  const increasedLimitDestination = isIncreasedLimitDestination(destinationCode) ? 1.25 : 1;

  const maxTaxableUsd = maxDailyRentalAmount * rentalDays * increasedLimitDestination * -1;

  category[defaultLocalCurrency].maxTaxable += 0; // TODO: calculate
  category[defaultCryptoConversionFiatCurrency].maxTaxable += maxTaxableUsd;

  // set taxable amounts
  const taxableAmount = Math.max(
    category[defaultCryptoConversionFiatCurrency].total,
    maxTaxableUsd,
  );
  const taxablePortion =
    category[defaultCryptoConversionFiatCurrency].total === 0
      ? 0
      : taxableAmount / category[defaultCryptoConversionFiatCurrency].total;

  category[defaultLocalCurrency].taxable += category[defaultLocalCurrency].total * taxablePortion;
  category[defaultCryptoConversionFiatCurrency].taxable += taxableAmount;

  return void 0;
}

export function isIncreasedLimitDestination(destinationCode: string | null) {
  if (!destinationCode) {
    return false;
  }
  const increasedLimitDestinations = [
    'AGO', // angola
    'AUS', // australia
    'AUT', // austria
    'BEL', // belgium
    'CMR', // cameroon
    'CAN', // canada
    'DNK', // denmark
    'ARE', // dubai
    'FIN', // finland
    'FRA', // france
    'DEU', // germany
    'GRC', // greece
    'HKG', // hong kong
    'ISL', // iceland
    'IRL', // ireland
    'ITA', // italy
    'JPN', // japan
    'KOR', // south korea
    'PRK', // north korea
    'LUX', // luxembourg
    'NLD', // netherlands
    'NOR', // norway
    'OMN', // oman
    'QAT', // qatar
    'ESP', // spain
    'SWE', // sweden
    'CHE', // switzerland
    'TWN', // taiwan
    'GBR', // united kingdom
  ];
  return increasedLimitDestinations.includes(destinationCode.toLocaleUpperCase());
}

export function onlyUnique(value: string, index: number, array: string[]) {
  return array.indexOf(value) === index;
}

export function getAttendeeTravelAndSubsistenceMaxTax(
  totalBusinessDays: number,
  unAccommodatedDays: number,
  destinationCode: string | null,
  taxVariables: IGetAllTaxVariablesResult,
): number {
  const { max_tns_with_accommodation, max_tns_without_accommodation } = taxVariables;
  const maxExpenseWithAccommodation = Number(max_tns_with_accommodation);
  const maxExpenseWithoutAccommodation = Number(max_tns_without_accommodation);

  if (Number.isNaN(maxExpenseWithAccommodation) || Number.isNaN(maxExpenseWithoutAccommodation)) {
    throw new BusinessTripError('Tax variables are not set');
  }

  const accommodatedDays = totalBusinessDays - unAccommodatedDays;

  const increasedLimitFactor = isIncreasedLimitDestination(destinationCode) ? 1.25 : 1;

  const maxTaxableUsd =
    (maxExpenseWithAccommodation * accommodatedDays +
      maxExpenseWithoutAccommodation * unAccommodatedDays) *
    increasedLimitFactor *
    -1;

  return maxTaxableUsd;
}

export * from './business-trip-report-accommodation.helper.js';
