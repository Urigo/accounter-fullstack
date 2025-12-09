import { differenceInDays } from 'date-fns';
import { GraphQLError } from 'graphql';
import type {
  BusinessTripSummary,
  BusinessTripSummaryCategories,
} from '../../../__generated__/types.js';
import {
  accommodationExpenseDataCollector,
  AttendeeInfo,
  calculateTotalReportSummaryCategory,
  carRentalExpensesDataCollector,
  convertSummaryCategoryDataToRow,
  flightExpenseDataCollector,
  onlyUnique,
  otherExpensesDataCollector,
  SummaryData,
  travelAndSubsistenceExpensesDataCollector,
} from '../helpers/business-trip-report.helper.js';
import { BusinessTripAttendeesProvider } from '../providers/business-trips-attendees.provider.js';
import { BusinessTripExpensesProvider } from '../providers/business-trips-expenses.provider.js';
import { BusinessTripTaxVariablesProvider } from '../providers/business-trips-tax-variables.provider.js';
import type { BusinessTripProto } from '../types.js';

export class BusinessTripError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export async function businessTripSummary(
  context: GraphQLModules.Context,
  dbBusinessTrip: BusinessTripProto,
): Promise<BusinessTripSummary> {
  const { injector } = context;
  try {
    const attendees = await injector
      .get(BusinessTripAttendeesProvider)
      .getBusinessTripsAttendeesByBusinessTripIdLoader.load(dbBusinessTrip.id);

    if (!attendees?.length) {
      return {
        rows: [],
        errors: ['Attendees are not set'],
      };
    }

    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    attendees.map(attendee => {
      const { arrival, departure } = attendee;

      if (arrival && (!fromDate || arrival < fromDate)) {
        fromDate = arrival;
      }

      if (departure && (!toDate || departure > toDate)) {
        toDate = departure;
      }
    });

    if (!fromDate || !toDate) {
      return {
        rows: [],
        errors: ['Business trip dates are not set'],
      };
    }

    const expensesPromise = await injector
      .get(BusinessTripExpensesProvider)
      .getBusinessTripExtendedExpensesByBusinessTripId(dbBusinessTrip.id);
    const taxVariablesPromise = injector
      .get(BusinessTripTaxVariablesProvider)
      .getTaxVariablesByDateLoader.load(toDate);

    const [
      {
        flightExpenses,
        accommodationsExpenses,
        travelAndSubsistenceExpenses,
        otherExpenses,
        carRentalExpenses,
      },
      taxVariables,
    ] = await Promise.all([expensesPromise, taxVariablesPromise]);

    if (!taxVariables) {
      return {
        rows: [],
        errors: ['Tax variables are not set'],
      };
    }

    const summaryData: Partial<SummaryData> = {};
    const attendeesMap = new Map<string, AttendeeInfo>();
    attendees.map(attendee => {
      const { arrival, departure } = attendee;

      let daysCount = 0;
      let nightsCount = 0;
      if (arrival && departure) {
        daysCount = differenceInDays(departure, arrival) + 1;
        nightsCount = daysCount - 1;
      }
      attendeesMap.set(attendee.id, {
        name: attendee.name,
        arrival,
        departure,
        daysCount,
        nightsCount,
      });
    });

    const errors: string[] = [];

    const [unAccommodatedDays] = await Promise.all([
      accommodationExpenseDataCollector(
        context,
        accommodationsExpenses,
        summaryData,
        dbBusinessTrip.destination,
        taxVariables,
        attendeesMap,
      ).catch(e => {
        if (e instanceof BusinessTripError) {
          errors.push(e.message);
        } else {
          console.error(`Error handling accommodation expenses`, e);
          throw new GraphQLError((e as Error)?.message ?? `Error handling accommodation expenses`);
        }
      }),
      ...flightExpenses.map(flightExpense =>
        flightExpenseDataCollector(context, flightExpense, summaryData).catch(e => {
          if (e instanceof BusinessTripError) {
            errors.push(e.message);
          } else {
            console.error(`Error handling flight expenses`, e);
            throw new GraphQLError((e as Error)?.message ?? `Error handling flight expenses`);
          }
        }),
      ),
      otherExpensesDataCollector(context, otherExpenses, summaryData).catch(e => {
        if (e instanceof BusinessTripError) {
          errors.push(e.message);
        } else {
          console.error(`Error handling other expenses`, e);
          throw new GraphQLError((e as Error)?.message ?? `Error handling other expenses`);
        }
      }),
      carRentalExpensesDataCollector(
        context,
        carRentalExpenses,
        summaryData,
        taxVariables,
        dbBusinessTrip.destination,
      ).catch(e => {
        if (e instanceof BusinessTripError) {
          errors.push(e.message);
        } else {
          console.error(`Error handling car rental expenses`, e);
          throw new GraphQLError((e as Error)?.message ?? `Error handling car rental expenses`);
        }
      }),
    ]);

    await travelAndSubsistenceExpensesDataCollector(
      context,
      travelAndSubsistenceExpenses,
      summaryData,
      taxVariables,
      {
        destinationCode: dbBusinessTrip.destination,
        attendees: attendeesMap,
        unAccommodatedDays: unAccommodatedDays ?? 0,
      },
    ).catch(e => {
      if (e instanceof BusinessTripError) {
        errors.push(e.message);
      } else {
        console.error(`Error handling travel and subsistence expenses`, e);
        throw new GraphQLError(
          (e as Error)?.message ?? `Error handling travel and subsistence expenses`,
        );
      }
    });

    const totalSumCategory = calculateTotalReportSummaryCategory(summaryData);
    summaryData['TOTAL'] = totalSumCategory;

    return {
      rows: Object.entries(summaryData).map(([category, data]) =>
        convertSummaryCategoryDataToRow(category as BusinessTripSummaryCategories, data),
      ),
      errors: errors.length ? errors.filter(onlyUnique) : undefined,
    };
  } catch (e) {
    console.error(`Error fetching business trip expenses`, e);
    throw new GraphQLError((e as Error)?.message ?? `Error fetching business trip expenses`);
  }
}
