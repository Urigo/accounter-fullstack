import { Injector } from 'graphql-modules';
import { DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY, DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import type { BusinessTripAttendeeStayInput } from '@shared/gql-types';
import { BusinessTripAttendeesProvider } from '../providers/business-trips-attendees.provider.js';
import { BusinessTripAccommodationsExpensesProvider } from '../providers/business-trips-expenses-accommodations.provider.js';
import { BusinessTripError } from '../resolvers/business-trip-summary.resolver.js';
import type {
  IGetAllTaxVariablesResult,
  IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsResult,
  IGetLastFlightByDateAndAttendeeIdResult,
} from '../types.js';
import {
  AttendeeInfo,
  getExpenseAmountsData,
  isIncreasedLimitDestination,
  SummaryCategoryData,
  SummaryData,
} from './business-trip-report.helper.js';

type AccommodationTaxVariables = {
  upToSevenNights: number;
  eightOrMoreNights: number;
};

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

  // update total amounts and fill attendees accommodation map by expenses
  await Promise.all(
    businessTripExpenses.map(async businessTripExpense =>
      expenseAccommodationTaxableAmounts(
        injector,
        businessTripExpense,
        attendeesAccommodationMap,
      ).then(({ localAmount, foreignAmount }) => {
        category[DEFAULT_LOCAL_CURRENCY]!.total += localAmount;
        category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY]!.total += foreignAmount;
      }),
    ),
  );

  // get tax variables
  const accommodationTaxVariables = getAccommodationTaxVariablesUSD(destinationCode, taxVariables);

  let unAccommodatedDays = 0;

  // update taxable amounts and max taxable amounts by attendees
  await Promise.all(
    Array.from(attendeesMap.entries()).map(async ([attendeeId, attendeeInfo]) => {
      const {
        taxableLocal,
        taxableForeign,
        maxTaxableLocal,
        maxTaxableForeign,
        unAccommodatedAttendeeDays,
      } = await attendeeAccommodationTaxableAmounts(
        injector,
        attendeeId,
        attendeeInfo,
        accommodationTaxVariables,
        attendeesAccommodationMap.get(attendeeId),
      );

      category[DEFAULT_LOCAL_CURRENCY]!.maxTaxable += maxTaxableLocal;
      category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY]!.maxTaxable += maxTaxableForeign;
      category[DEFAULT_LOCAL_CURRENCY]!.taxable += taxableLocal;
      category[DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY]!.taxable += taxableForeign;

      unAccommodatedDays += unAccommodatedAttendeeDays;
    }),
  );

  return unAccommodatedDays;
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

async function expenseAccommodationTaxableAmounts(
  injector: Injector,
  businessTripExpense: IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsResult,
  attendeesAccommodationMap: Map<
    string,
    { localAmount: number; foreignAmount: number; nights: number }
  >,
) {
  const { localAmount, foreignAmount } = await getExpenseAmountsData(injector, businessTripExpense);

  if (!businessTripExpense.nights_count) {
    console.error(
      `Nights count not found for accommodation trip expense ID ${businessTripExpense.id}`,
    );
    throw new BusinessTripError('Accommodation expenses: some expenses are missing nights count');
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
      foreignAmount: attendeeAccommodationData.foreignAmount + foreignAmountPerNight * nightsCount,
    });
  });

  if (cumulativeExpenseAccommodationNights !== businessTripExpense.nights_count) {
    console.error(
      `Attendees nights count (${cumulativeExpenseAccommodationNights}) doesn't match total nights count (${businessTripExpense.nights_count}) for expense ID ${businessTripExpense.id}`,
    );
    throw new BusinessTripError('Accommodation expenses: attendees nights count mismatch');
  }

  return { localAmount, foreignAmount };
}

async function attendeeAccommodationTaxableAmounts(
  injector: Injector,
  attendeeId: string,
  attendeeInfo: Pick<AttendeeInfo, 'nightsCount' | 'arrival'>,
  accommodationTaxVariables: AccommodationTaxVariables,
  attendeeAccommodationData?: { nights: number; localAmount: number; foreignAmount: number },
) {
  const { nightsCount: totalNights, arrival } = attendeeInfo;

  if (!totalNights) {
    // no nights, no accommodation
    return {
      taxableLocal: 0,
      taxableForeign: 0,
      maxTaxableLocal: 0,
      maxTaxableForeign: 0,
      unAccommodatedAttendeeDays: 0,
    };
  }

  if (totalNights && !attendeeAccommodationData) {
    // no accommodation data, no accommodation
    return {
      taxableLocal: 0,
      taxableForeign: 0,
      maxTaxableLocal: 0,
      maxTaxableForeign: 0,
      unAccommodatedAttendeeDays: totalNights + 1,
    };
  }

  if (arrival === null) {
    console.error(`Arrival date not found for attendee ID ${attendeeId}`);
    throw new BusinessTripError('Accommodation expenses: arrival date not found');
  }

  const prevAccommodatedNights = await sumAccommodatedNightsOnPreviousConsecutiveTrips(
    injector,
    attendeeId,
    arrival,
  );

  // validate attendee accommodation data
  const { nights: accommodationNights, localAmount, foreignAmount } = attendeeAccommodationData!;

  if (accommodationNights > totalNights) {
    console.error(
      `Accommodated nights (${accommodationNights}) exceed total nights (${totalNights})`,
    );
    throw new BusinessTripError(
      'Accommodation expenses: accommodated nights exceed total nights stay',
    );
  }

  // calculate taxable amount
  const maxTaxableUsd = calculateMaxTaxableAttendeeAmountWithPrevTrips(
    accommodationNights,
    prevAccommodatedNights,
    accommodationTaxVariables,
  );

  const maxTaxableLocal = 0; // TODO: calculate
  const maxTaxableForeign = maxTaxableUsd;
  const unAccommodatedAttendeeDays =
    totalNights > accommodationNights ? totalNights - accommodationNights : 0;

  const effectiveTaxableForeignAmount = calculateEffectiveTaxableAmountOverWeek(
    foreignAmount,
    accommodationNights,
    prevAccommodatedNights,
    accommodationTaxVariables,
  );
  const taxableAmount = Math.max(effectiveTaxableForeignAmount, maxTaxableUsd); // amounts are negative, so we take the max (abs min)
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

function calculateEffectiveTaxableAmountOverWeek(
  amount: number,
  nights: number,
  prevNights: number,
  accommodationTaxVariables: AccommodationTaxVariables,
): number {
  if (prevNights + nights < 7) {
    return amount;
  }
  if (prevNights > 7) {
    return calculateEffectiveTaxableAmount(amount, nights, accommodationTaxVariables);
  }
  const leftAccommodatedNightsUnderWeek = 7 - prevNights;
  const dailyAmount = amount / nights;

  // calculate leftAccommodatedNightsUnderWeek with full tax rate
  const fullTaxableNightsAmount = leftAccommodatedNightsUnderWeek * dailyAmount;

  // calculate rest of the days with lower tax rate
  const overSevenNights = Math.max(0, nights - leftAccommodatedNightsUnderWeek);
  const partialTaxableNightsAmount = overSevenNights * dailyAmount;

  return (
    fullTaxableNightsAmount +
    calculateEffectiveTaxableAmount(
      partialTaxableNightsAmount,
      overSevenNights,
      accommodationTaxVariables,
    )
  );
}

function calculateMaxTaxableAttendeeAmount(
  totalAttendeeNights: number,
  { upToSevenNights, eightOrMoreNights }: AccommodationTaxVariables,
): number {
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
  prevAccommodatedNights: number,
  accommodationTaxVariables: AccommodationTaxVariables,
): number {
  if (!prevAccommodatedNights) {
    // case no previous trips, regular calculation of current trip
    return calculateMaxTaxableAttendeeAmount(totalAttendeeNights, accommodationTaxVariables);
  }

  if (prevAccommodatedNights + totalAttendeeNights > 90) {
    // case over 90 days, regular calculation of all days
    return calculateMaxTaxableAttendeeAmount(
      prevAccommodatedNights + totalAttendeeNights,
      accommodationTaxVariables,
    );
  }

  // case 8 to 90 days, calculate current trip taxable amount
  const allConsecutiveTripsTaxableAmount = calculateMaxTaxableAttendeeAmount(
    prevAccommodatedNights + totalAttendeeNights,
    accommodationTaxVariables,
  );
  const prevTripsTaxableAmount = calculateMaxTaxableAttendeeAmount(
    prevAccommodatedNights,
    accommodationTaxVariables,
  );
  const currentTripTaxableAmount = allConsecutiveTripsTaxableAmount - prevTripsTaxableAmount;
  return currentTripTaxableAmount;
}

function calculateEffectiveTaxableAmount(
  amount: number,
  accommodatedNights: number,
  accommodationTaxVariables: AccommodationTaxVariables,
): number {
  const minTaxableAmount = accommodatedNights * accommodationTaxVariables.eightOrMoreNights * -1; // negative amount since we're dealing with expenses

  if (amount > minTaxableAmount) {
    // dealing with negative amounts so sign is flipped
    return amount;
  }
  if (amount * 0.75 < minTaxableAmount) {
    // dealing with negative amounts so sign is flipped
    return amount * 0.75;
  }
  return minTaxableAmount;
}

/**
 * Calculate the sum of accommodated nights on previous consecutive trips
 * @param injector
 * @param attendeeId
 * @param arrival
 * @returns
 */
async function sumAccommodatedNightsOnPreviousConsecutiveTrips(
  injector: Injector,
  attendeeId: string,
  arrival: Date,
): Promise<number> {
  let attendeePreviousTrip: IGetLastFlightByDateAndAttendeeIdResult | undefined = undefined;
  [attendeePreviousTrip] = await injector
    .get(BusinessTripAttendeesProvider)
    .getLastFlightByDateAndAttendeeId({
      attendeeBusinessId: attendeeId,
      date: arrival,
    });
  if (!attendeePreviousTrip) {
    return 0;
  }
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
