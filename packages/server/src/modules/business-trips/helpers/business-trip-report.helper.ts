import { Injector } from 'graphql-modules';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { IGetTransactionsByIdsResult } from '@modules/transactions/types.js';
import { DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY, DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import {
  Currency,
  type BusinessTripAttendeeStayInput,
  type BusinessTripSummaryCategories,
  type BusinessTripSummaryRow,
} from '@shared/gql-types';
import { formatCurrency, formatFinancialAmount } from '@shared/helpers';
import { BusinessTripError } from '../resolvers/business-trip-summary.resolver.js';
import type {
  flight_class,
  IGetAllTaxVariablesResult,
  IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsResult,
  IGetBusinessTripsCarRentalExpensesByBusinessTripIdsResult,
  IGetBusinessTripsExpensesByBusinessTripIdsResult,
  IGetBusinessTripsFlightsExpensesByBusinessTripIdsResult,
  IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsResult,
} from '../types.js';

export type SummaryCategoryData = Partial<
  Record<
    typeof DEFAULT_LOCAL_CURRENCY | typeof DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY,
    { total: number; taxable: number; maxTaxable: number }
  >
>;
export type SummaryData = Record<BusinessTripSummaryCategories, SummaryCategoryData>;
export type AttendeeInfo = {
  name: string;
  daysCount: number;
  nightsCount: number;
};

type AccommodationTaxVariables = {
  upToSevenNights: number;
  eightOrMoreNights: number;
};

export function convertSummaryCategoryDataToRow(
  category: BusinessTripSummaryCategories,
  data: SummaryCategoryData,
): BusinessTripSummaryRow {
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
    excessExpenditure: formatFinancialAmount(0, Currency.Ils),
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
    currency === DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY
      ? Promise.resolve(1)
      : injector
          .get(ExchangeProvider)
          .getExchangeRates(currency, DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY, date);
  const [localRate, foreignRate] = await Promise.all([exchangeRatePromise, usdRatePromise]);
  const localAmount = localRate * amount;
  const foreignAmount = foreignRate * amount;
  return { localAmount, foreignAmount };
}

async function getExpenseAmountsData(
  injector: Injector,
  businessTripExpense: IGetBusinessTripsExpensesByBusinessTripIdsResult,
) {
  try {
    const { amount, currency, date } = getExpenseCoreData(businessTripExpense);

    const { localAmount, foreignAmount } = await getDefaultCurrenciesAmountsAndExchangeRate(
      injector,
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
      .getTransactionByIdLoader.loadMany(businessTripExpense.transaction_ids);

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
        const date =
          transaction.debit_timestamp || transaction.debit_date || transaction.event_date;

        if (!amount || !currency || !date) {
          const errorMessage = `Currency, amount or date not found for transaction ID ${transaction.id}`;
          console.error(errorMessage);
          throw new BusinessTripError(errorMessage);
        }

        const { localAmount: transactionLocalAmount, foreignAmount: transactionForeignAmount } =
          await getDefaultCurrenciesAmountsAndExchangeRate(injector, currency, amount, date);

        localAmount += transactionLocalAmount;
        foreignAmount += transactionForeignAmount;
      }),
    );

    return { localAmount, foreignAmount };
  }
}

export async function flightExpenseDataCollector(
  injector: Injector,
  businessTripExpense: IGetBusinessTripsFlightsExpensesByBusinessTripIdsResult,
  partialSummaryData: Partial<SummaryData>,
): Promise<void> {
  // populate category
  partialSummaryData['FLIGHT'] ??= {};
  const category = partialSummaryData['FLIGHT'] as SummaryCategoryData;

  const { localAmount, foreignAmount } = await getExpenseAmountsData(injector, businessTripExpense);

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
  category[DEFAULT_LOCAL_CURRENCY] ||= { total: 0, taxable: 0, maxTaxable: 0 };
  category[DEFAULT_LOCAL_CURRENCY].total += localAmount;
  category[DEFAULT_LOCAL_CURRENCY].taxable += localTaxable;
  category[DEFAULT_LOCAL_CURRENCY].maxTaxable += localTaxable;
  category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY] ||= { total: 0, taxable: 0, maxTaxable: 0 };
  category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY].total += foreignAmount;
  category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY].taxable += foreignTaxable;
  category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY].maxTaxable += foreignTaxable;

  return void 0;
}

export async function accommodationExpenseDataCollector(
  injector: Injector,
  businessTripExpenses: IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsResult[],
  partialSummaryData: Partial<SummaryData>,
  destination: string | null,
  taxVariables: IGetAllTaxVariablesResult,
  attendeesMap: Map<string, AttendeeInfo>,
): Promise<number> {
  // populate category
  partialSummaryData['ACCOMMODATION'] ??= {};
  const category = partialSummaryData['ACCOMMODATION'] as SummaryCategoryData;

  category[DEFAULT_LOCAL_CURRENCY] ||= { total: 0, taxable: 0, maxTaxable: 0 };
  category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY] ||= { total: 0, taxable: 0, maxTaxable: 0 };

  // set actual expense amounts and collect attendee accommodation data
  const attendeesAccommodationMap = new Map<
    string,
    { localAmount: number; foreignAmount: number; nights: number }
  >();

  await Promise.all(
    businessTripExpenses.map(async businessTripExpense => {
      const { localAmount, foreignAmount } = await getExpenseAmountsData(
        injector,
        businessTripExpense,
      );

      if (!businessTripExpense.nights_count) {
        console.error(
          `Nights count not found for accommodation trip expense ID ${businessTripExpense.id}`,
        );
        throw new BusinessTripError(
          'Accommodation expenses: some expenses are missing nights count',
        );
      }

      const localAmountPerNight = localAmount / businessTripExpense.nights_count;
      const foreignAmountPerNight = foreignAmount / businessTripExpense.nights_count;

      if (!Number.isInteger(businessTripExpense.nights_count)) {
        console.error(`Nights count must be an integer`);
        throw new BusinessTripError('Accommodation expenses: nights count must be an integer');
      }

      const attendeesStay = businessTripExpense.attendees_stay.filter(
        Boolean,
      ) as BusinessTripAttendeeStayInput[];
      let attendeesStayNightsCount = 0;

      attendeesStay.map(({ attendeeId, nightsCount = 0 }) => {
        attendeesStayNightsCount += nightsCount;

        if (!attendeesAccommodationMap.has(attendeeId)) {
          attendeesAccommodationMap.set(attendeeId, {
            nights: nightsCount,
            localAmount: localAmountPerNight * nightsCount,
            foreignAmount: foreignAmountPerNight * nightsCount,
          });
          return;
        }

        const attendeeAccommodationData = attendeesAccommodationMap.get(attendeeId)!;
        attendeesAccommodationMap.set(attendeeId, {
          nights: attendeeAccommodationData.nights + nightsCount,
          localAmount: attendeeAccommodationData.localAmount + localAmountPerNight * nightsCount,
          foreignAmount:
            attendeeAccommodationData.foreignAmount + foreignAmountPerNight * nightsCount,
        });
      });

      if (attendeesStayNightsCount !== businessTripExpense.nights_count) {
        console.error(
          `Attendees nights count (${attendeesStayNightsCount}) doesn't match total nights count (${businessTripExpense.nights_count}) for expense ID ${businessTripExpense.id}`,
        );
        throw new BusinessTripError('Accommodation expenses: attendees nights count mismatch');
      }

      category[DEFAULT_LOCAL_CURRENCY]!.total += localAmount;
      category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY]!.total += foreignAmount;
    }),
  );

  // calculate taxable amount
  const accommodationTaxVariables = getAccommodationTaxVariablesUSD(destination, taxVariables);

  let unAccommodatedDays = 0;

  // set taxable amounts
  for (const [attendeeId, { nightsCount: totalNights }] of Array.from(attendeesMap.entries())) {
    const maxTaxableUsd = calculateMaxTaxableAttendeeAmount(totalNights, accommodationTaxVariables);

    category[DEFAULT_LOCAL_CURRENCY]!.maxTaxable += 0; // TODO: calculate
    category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY]!.maxTaxable += maxTaxableUsd;

    if (!attendeesAccommodationMap.has(attendeeId)) {
      unAccommodatedDays += totalNights;
      continue;
    }

    const {
      nights: accommodationNights,
      localAmount,
      foreignAmount,
    } = attendeesAccommodationMap.get(attendeeId)!;

    if (accommodationNights > totalNights) {
      console.error(
        `Accommodated nights (${accommodationNights}) exceed total nights (${totalNights})`,
      );
      throw new BusinessTripError(
        'Accommodation expenses: accommodated nights exceed total nights stay',
      );
    }

    if (totalNights > accommodationNights) {
      unAccommodatedDays += totalNights - accommodationNights;
    }

    const taxableAmount = Math.max(foreignAmount, maxTaxableUsd);
    const taxablePortion = taxableAmount / foreignAmount;

    // update amounts
    category[DEFAULT_LOCAL_CURRENCY]!.taxable += localAmount * taxablePortion;
    category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY]!.taxable += taxableAmount;
  }

  return unAccommodatedDays;
}

export async function otherExpensesDataCollector(
  injector: Injector,
  otherExpenses: IGetBusinessTripsExpensesByBusinessTripIdsResult[],
  partialSummaryData: Partial<SummaryData>,
): Promise<string | void> {
  // populate category
  partialSummaryData['OTHER'] ??= {};
  const category = partialSummaryData['OTHER'] as SummaryCategoryData;
  category[DEFAULT_LOCAL_CURRENCY] ||= { total: 0, taxable: 0, maxTaxable: 0 };
  category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY] ||= { total: 0, taxable: 0, maxTaxable: 0 };

  if (otherExpenses.length === 0) {
    return void 0;
  }

  await Promise.all(
    otherExpenses.map(async businessTripExpense => {
      const { localAmount, foreignAmount } = await getExpenseAmountsData(
        injector,
        businessTripExpense,
      );

      category[DEFAULT_LOCAL_CURRENCY]!.total += localAmount;
      category[DEFAULT_LOCAL_CURRENCY]!.taxable += localAmount;
      category[DEFAULT_LOCAL_CURRENCY]!.maxTaxable += localAmount;
      category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY]!.total += foreignAmount;
      category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY]!.taxable += foreignAmount;
      category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY]!.maxTaxable += foreignAmount;
    }),
  );

  return void 0;
}

type ReportMetaData = {
  destination: string | null;
  unAccommodatedDays: number;
  attendees: Map<string, AttendeeInfo>;
};

export async function travelAndSubsistenceExpensesDataCollector(
  injector: Injector,
  businessTripExpenses: IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsResult[],
  partialSummaryData: Partial<SummaryData>,
  taxVariables: IGetAllTaxVariablesResult,
  { destination, unAccommodatedDays, attendees }: ReportMetaData,
): Promise<void> {
  // populate category
  partialSummaryData['TRAVEL_AND_SUBSISTENCE'] ??= {};
  const category = partialSummaryData['TRAVEL_AND_SUBSISTENCE'] as SummaryCategoryData;
  category[DEFAULT_LOCAL_CURRENCY] ||= { total: 0, taxable: 0, maxTaxable: 0 };
  category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY] ||= { total: 0, taxable: 0, maxTaxable: 0 };

  const totalBusinessDays = Array.from(attendees.values()).reduce(
    (acc, attendee) => acc + attendee.daysCount,
    0,
  );

  const maxTaxableUsd = getAttendeeTravelAndSubsistenceMaxTax(
    totalBusinessDays,
    unAccommodatedDays,
    destination,
    taxVariables,
  );

  category[DEFAULT_LOCAL_CURRENCY].maxTaxable += 0; // TODO: calculate
  category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY].maxTaxable += maxTaxableUsd;

  // set actual expense amounts
  await Promise.all(
    businessTripExpenses.map(async businessTripExpense => {
      const { localAmount, foreignAmount } = await getExpenseAmountsData(
        injector,
        businessTripExpense,
      );

      category[DEFAULT_LOCAL_CURRENCY]!.total += localAmount;
      category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY]!.total += foreignAmount;
    }),
  );

  // set taxable amounts
  const taxableAmount = Math.max(
    category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY].total,
    maxTaxableUsd,
  );
  const taxablePortion =
    category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY].total === 0
      ? 0
      : taxableAmount / category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY].total;

  category[DEFAULT_LOCAL_CURRENCY].taxable +=
    category[DEFAULT_LOCAL_CURRENCY].total * taxablePortion;
  category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY].taxable += taxableAmount;

  return void 0;
}

export async function carRentalExpensesDataCollector(
  injector: Injector,
  businessTripExpenses: IGetBusinessTripsCarRentalExpensesByBusinessTripIdsResult[],
  partialSummaryData: Partial<SummaryData>,
  taxVariables: IGetAllTaxVariablesResult,
  destination: string | null,
): Promise<void> {
  // populate category
  partialSummaryData['CAR_RENTAL'] ??= {};
  const category = partialSummaryData['CAR_RENTAL'] as SummaryCategoryData;
  category[DEFAULT_LOCAL_CURRENCY] ||= { total: 0, taxable: 0, maxTaxable: 0 };
  category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY] ||= { total: 0, taxable: 0, maxTaxable: 0 };

  let rentalDays = 0;

  // set actual expense amounts
  await Promise.all(
    businessTripExpenses.map(async businessTripExpense => {
      if (!businessTripExpense.is_fuel_expense) {
        rentalDays += businessTripExpense.days;
      }

      const { localAmount, foreignAmount } = await getExpenseAmountsData(
        injector,
        businessTripExpense,
      );

      category[DEFAULT_LOCAL_CURRENCY]!.total += localAmount;
      category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY]!.total += foreignAmount;
    }),
  );

  // set max taxable amounts
  const { max_car_rental_per_day } = taxVariables;
  const maxDailyRentalAmount = Number(max_car_rental_per_day);

  if (Number.isNaN(maxDailyRentalAmount)) {
    throw new BusinessTripError('Tax variables are not set');
  }

  const increasedLimitDestination = isIncreasedLimitDestination(destination) ? 1.25 : 1;

  const maxTaxableUsd = maxDailyRentalAmount * rentalDays * increasedLimitDestination * -1;

  category[DEFAULT_LOCAL_CURRENCY].maxTaxable += 0; // TODO: calculate
  category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY].maxTaxable += maxTaxableUsd;

  // set taxable amounts
  const taxableAmount = Math.max(
    category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY].total,
    maxTaxableUsd,
  );
  const taxablePortion =
    category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY].total === 0
      ? 0
      : taxableAmount / category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY].total;

  category[DEFAULT_LOCAL_CURRENCY].taxable +=
    category[DEFAULT_LOCAL_CURRENCY].total * taxablePortion;
  category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY].taxable += taxableAmount;

  return void 0;
}

function isIncreasedLimitDestination(destination: string | null) {
  if (!destination) {
    return false;
  }
  const increasedLimitDestinations = [
    'angola',
    'australia',
    'austria',
    'belgium',
    'cameroon',
    'canada',
    'denmark',
    'dubai',
    'finland',
    'france',
    'germany',
    'greece',
    'hong kong',
    'iceland',
    'ireland',
    'italy',
    'japan',
    'korea',
    'luxembourg',
    'netherlands',
    'norway',
    'oman',
    'qatar',
    'spain',
    'sweden',
    'switzerland',
    'taiwan',
    'united kingdom',
  ];
  return increasedLimitDestinations.includes(destination.toLowerCase());
}

function getAccommodationTaxVariablesUSD(
  destination: string | null,
  taxVariables: IGetAllTaxVariablesResult,
): AccommodationTaxVariables {
  const { max_accommodation_per_night_first_7_nights, max_accommodation_per_night_nights_8_to_90 } =
    taxVariables;
  const increasedLimitDestination = isIncreasedLimitDestination(destination) ? 1.25 : 1;

  const upToSevenNights =
    Number(max_accommodation_per_night_first_7_nights) * increasedLimitDestination;
  const eightOrMoreNights =
    Number(max_accommodation_per_night_nights_8_to_90) * increasedLimitDestination;

  if (Number.isNaN(upToSevenNights) || Number.isNaN(eightOrMoreNights)) {
    throw new BusinessTripError('Tax variables are not set');
  }

  return {
    upToSevenNights,
    eightOrMoreNights,
  };
}

export function onlyUnique(value: string, index: number, array: string[]) {
  return array.indexOf(value) === index;
}

function calculateMaxTaxableAttendeeAmount(
  totalAttendeeNights: number,
  { upToSevenNights, eightOrMoreNights }: AccommodationTaxVariables,
) {
  let maxTaxableUsd = 0;

  if (totalAttendeeNights <= 7) {
    // up to 7 days
    maxTaxableUsd += totalAttendeeNights * upToSevenNights;
  } else if (totalAttendeeNights > 90) {
    // over 90 days
    maxTaxableUsd += 90 * eightOrMoreNights;
  } else {
    // 8 to 90 days
    const remainingNights = totalAttendeeNights - 7;
    maxTaxableUsd += 7 * upToSevenNights + remainingNights * upToSevenNights * 0.75;
  }

  maxTaxableUsd *= -1;

  return maxTaxableUsd;
}

export function getAttendeeAccommodationMaxTax(
  totalAttendeeNights: number,
  destination: string | null,
  taxVariables: IGetAllTaxVariablesResult,
): number {
  const accommodationTaxVariables = getAccommodationTaxVariablesUSD(destination, taxVariables);

  return calculateMaxTaxableAttendeeAmount(totalAttendeeNights, accommodationTaxVariables);
}

export function getAttendeeTravelAndSubsistenceMaxTax(
  totalBusinessDays: number,
  unAccommodatedDays: number,
  destination: string | null,
  taxVariables: IGetAllTaxVariablesResult,
): number {
  const { max_tns_with_accommodation, max_tns_without_accommodation } = taxVariables;
  const maxExpenseWithAccommodation = Number(max_tns_with_accommodation);
  const maxExpenseWithoutAccommodation = Number(max_tns_without_accommodation);

  if (Number.isNaN(maxExpenseWithAccommodation) || Number.isNaN(maxExpenseWithoutAccommodation)) {
    throw new BusinessTripError('Tax variables are not set');
  }

  const accommodatedDays = totalBusinessDays - unAccommodatedDays;

  const increasedLimitFactor = isIncreasedLimitDestination(destination) ? 1.25 : 1;

  const maxTaxableUsd =
    (maxExpenseWithAccommodation * accommodatedDays +
      maxExpenseWithoutAccommodation * unAccommodatedDays) *
    increasedLimitFactor *
    -1;

  return maxTaxableUsd;
}
