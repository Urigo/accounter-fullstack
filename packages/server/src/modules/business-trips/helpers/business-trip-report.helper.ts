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
import { BusinessTripAttendeesProvider } from '../providers/business-trips-attendees.provider.js';
import { BusinessTripAccommodationsExpensesProvider } from '../providers/business-trips-expenses-accommodations.provider.js';
import { BusinessTripError } from '../resolvers/business-trip-summary.resolver.js';
import type {
  flight_class,
  IGetAllTaxVariablesResult,
  IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsResult,
  IGetBusinessTripsCarRentalExpensesByBusinessTripIdsResult,
  IGetBusinessTripsExpensesByBusinessTripIdsResult,
  IGetBusinessTripsFlightsExpensesByBusinessTripIdsResult,
  IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsResult,
  IGetLastFlightByDateAndAttendeeIdResult,
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
  arrival: Date | null;
  departure: Date | null;
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
  destinationCode: string | null,
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

      if (!Number.isInteger(businessTripExpense.nights_count)) {
        console.error(`Nights count must be an integer`);
        throw new BusinessTripError('Accommodation expenses: nights count must be an integer');
      }

      const localAmountPerNight = localAmount / businessTripExpense.nights_count;
      const foreignAmountPerNight = foreignAmount / businessTripExpense.nights_count;

      const attendeesStay = businessTripExpense.attendees_stay.filter(
        Boolean,
      ) as BusinessTripAttendeeStayInput[];
      let cumulativeExpenseAccommodationNights = 0;

      attendeesStay.map(async ({ attendeeId, nightsCount = 0 }) => {
        cumulativeExpenseAccommodationNights += nightsCount;

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

      if (cumulativeExpenseAccommodationNights !== businessTripExpense.nights_count) {
        console.error(
          `Attendees nights count (${cumulativeExpenseAccommodationNights}) doesn't match total nights count (${businessTripExpense.nights_count}) for expense ID ${businessTripExpense.id}`,
        );
        throw new BusinessTripError('Accommodation expenses: attendees nights count mismatch');
      }

      category[DEFAULT_LOCAL_CURRENCY]!.total += localAmount;
      category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY]!.total += foreignAmount;
    }),
  );

  // calculate taxable amount
  const accommodationTaxVariables = getAccommodationTaxVariablesUSD(destinationCode, taxVariables);

  let unAccommodatedDays = 0;

  // set taxable amounts
  await Promise.all(
    Array.from(attendeesMap.entries()).map(
      async ([attendeeId, { nightsCount: totalNights, arrival }]) => {
        if (!attendeesAccommodationMap.has(attendeeId)) {
          unAccommodatedDays += totalNights + 1;
          return;
        }

        const {
          taxableLocal,
          taxableForeign,
          maxTaxableLocal,
          maxTaxableForeign,
          unAccommodatedAttendeeDays,
        } = await attendeeAccommodationTaxableAmounts(
          injector,
          attendeeId,
          totalNights,
          arrival,
          accommodationTaxVariables,
          attendeesAccommodationMap.get(attendeeId)!,
        );

        category[DEFAULT_LOCAL_CURRENCY]!.maxTaxable += maxTaxableLocal;
        category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY]!.maxTaxable += maxTaxableForeign;

        unAccommodatedDays += unAccommodatedAttendeeDays;

        // update amounts
        category[DEFAULT_LOCAL_CURRENCY]!.taxable += taxableLocal;
        category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY]!.taxable += taxableForeign;
      },
    ),
  );

  return unAccommodatedDays;
}

export async function employeeAccommodationDataByTrip() {}

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
  destinationCode: string | null;
  unAccommodatedDays: number;
  attendees: Map<string, AttendeeInfo>;
};

export async function travelAndSubsistenceExpensesDataCollector(
  injector: Injector,
  businessTripExpenses: IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsResult[],
  partialSummaryData: Partial<SummaryData>,
  taxVariables: IGetAllTaxVariablesResult,
  { destinationCode, unAccommodatedDays, attendees }: ReportMetaData,
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
    destinationCode,
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
  destinationCode: string | null,
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

  const increasedLimitDestination = isIncreasedLimitDestination(destinationCode) ? 1.25 : 1;

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

function isIncreasedLimitDestination(destinationCode: string | null) {
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

function getAccommodationTaxVariablesUSD(
  destinationCode: string | null,
  taxVariables: IGetAllTaxVariablesResult,
): AccommodationTaxVariables {
  const { max_accommodation_per_night_first_7_nights, max_accommodation_per_night_nights_8_to_90 } =
    taxVariables;
  const increasedLimitDestination = isIncreasedLimitDestination(destinationCode) ? 1.25 : 1;

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
  if (totalAttendeeNights === 0) {
    return 0;
  }

  let maxTaxableUsd = 0;

  if (totalAttendeeNights <= 7) {
    // up to 7 days
    maxTaxableUsd += totalAttendeeNights * upToSevenNights;
  } else if (totalAttendeeNights > 90) {
    // over 90 days
    maxTaxableUsd += totalAttendeeNights * eightOrMoreNights;
  } else {
    // 8 to 90 days
    const remainingNights = totalAttendeeNights - 7;
    maxTaxableUsd += 7 * upToSevenNights + remainingNights * upToSevenNights * 0.75;
  }

  maxTaxableUsd *= -1;

  return maxTaxableUsd;
}

function calculateMaxTaxableAttendeeAmountWithPrevTrips(
  totalAttendeeNights: number,
  accommodationTaxVariables: AccommodationTaxVariables,
  prevAccommodatedNights: number,
) {
  if (prevAccommodatedNights + totalAttendeeNights > 90) {
    return calculateMaxTaxableAttendeeAmount(
      prevAccommodatedNights + totalAttendeeNights,
      accommodationTaxVariables,
    );
  }
  return (
    calculateMaxTaxableAttendeeAmount(
      prevAccommodatedNights + totalAttendeeNights,
      accommodationTaxVariables,
    ) - calculateMaxTaxableAttendeeAmount(prevAccommodatedNights, accommodationTaxVariables)
  );
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

async function attendeeAccommodationTaxableAmounts(
  injector: Injector,
  attendeeId: string,
  totalNights: number,
  arrival: Date | null,
  accommodationTaxVariables: AccommodationTaxVariables,
  attendeeAccommodationData: { nights: number; localAmount: number; foreignAmount: number },
) {
  if (totalNights === 0) {
    return {
      taxableLocal: 0,
      taxableForeign: 0,
      maxTaxableLocal: 0,
      maxTaxableForeign: 0,
      unAccommodatedAttendeeDays: 0,
    };
  }

  if (arrival === null) {
    console.error(`Arrival date not found for attendee ID ${attendeeId}`);
    throw new BusinessTripError('Accommodation expenses: arrival date not found');
  }

  // check for consecutive trips (less than 14 days between trips)
  let attendeePreviousTrip: IGetLastFlightByDateAndAttendeeIdResult | undefined = undefined;
  [attendeePreviousTrip] = await injector
    .get(BusinessTripAttendeesProvider)
    .getLastFlightByDateAndAttendeeId({
      attendeeBusinessId: attendeeId,
      date: arrival,
    });
  let prevAccommodatedNights = 0;
  if (attendeePreviousTrip) {
    const previousTripIds: string[] = [];
    do {
      previousTripIds.push(attendeePreviousTrip.business_trip_id);
      if (attendeePreviousTrip?.arrival) {
        [attendeePreviousTrip] = await injector
          .get(BusinessTripAttendeesProvider)
          .getLastFlightByDateAndAttendeeId({
            attendeeBusinessId: attendeeId,
            date: attendeePreviousTrip.arrival,
          });
      } else {
        attendeePreviousTrip = undefined;
      }
    } while (attendeePreviousTrip);
    prevAccommodatedNights = await getPreviousTripsAccommodatedNights(
      injector,
      attendeeId,
      previousTripIds,
    );
  }

  // validate attendee accommodation data
  const { nights: accommodationNights, localAmount, foreignAmount } = attendeeAccommodationData;

  if (accommodationNights > totalNights) {
    console.error(
      `Accommodated nights (${accommodationNights}) exceed total nights (${totalNights})`,
    );
    throw new BusinessTripError(
      'Accommodation expenses: accommodated nights exceed total nights stay',
    );
  }

  // calculate taxable amount
  const maxTaxableUsd = prevAccommodatedNights
    ? calculateMaxTaxableAttendeeAmountWithPrevTrips(
        accommodationNights,
        accommodationTaxVariables,
        prevAccommodatedNights,
      )
    : calculateMaxTaxableAttendeeAmount(accommodationNights, accommodationTaxVariables);

  const maxTaxableLocal = 0; // TODO: calculate
  const maxTaxableForeign = maxTaxableUsd;
  const unAccommodatedAttendeeDays =
    totalNights > accommodationNights ? totalNights - accommodationNights : 0;

  const taxableAmount = Math.max(foreignAmount, maxTaxableUsd);
  const taxablePortion = taxableAmount / foreignAmount;

  const taxableLocal = localAmount * taxablePortion;
  const taxableForeign = taxableAmount;

  return {
    taxableLocal,
    taxableForeign,
    maxTaxableLocal,
    maxTaxableForeign,
    unAccommodatedAttendeeDays,
  };
}

async function getPreviousTripsAccommodatedNights(
  injector: Injector,
  attendeeId: string,
  previousTripIds: string[],
): Promise<number> {
  if (previousTripIds.length === 0) {
    return 0;
  }

  const accommodationExpenses = await injector
    .get(BusinessTripAccommodationsExpensesProvider)
    .getBusinessTripsAccommodationsExpensesByBusinessTripIdLoader.loadMany(previousTripIds)
    .then(
      res =>
        res
          .filter(r => !(r instanceof Error))
          .flat() as IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsResult[],
    );

  let accommodatedNights = 0;
  accommodationExpenses.map(expense => {
    const attendeesStay = expense.attendees_stay.filter(Boolean) as BusinessTripAttendeeStayInput[];
    attendeesStay.map(({ attendeeId: expenseAttendeeId, nightsCount }) => {
      if (expenseAttendeeId === attendeeId) {
        accommodatedNights += nightsCount;
      }
    });
  });
  return accommodatedNights;
}
