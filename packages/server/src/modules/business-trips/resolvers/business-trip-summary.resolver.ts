import { differenceInDays } from 'date-fns';
import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import type { BusinessTripSummaryCategories, ResolversTypes } from '@shared/gql-types';
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
  injector: Injector,
  dbBusinessTrip: BusinessTripProto,
): Promise<Awaited<ResolversTypes['BusinessTripSummary']>> {
  try {
    if (!dbBusinessTrip.from_date || !dbBusinessTrip.to_date) {
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
      .getTaxVariablesByDateLoader.load(dbBusinessTrip.to_date);
    const attendeesPromise = injector
      .get(BusinessTripAttendeesProvider)
      .getBusinessTripsAttendeesByBusinessTripIdLoader.load(dbBusinessTrip.id);

    const [
      {
        flightExpenses,
        accommodationsExpenses,
        travelAndSubsistenceExpenses,
        otherExpenses,
        carRentalExpenses,
      },
      taxVariables,
      attendees,
    ] = await Promise.all([expensesPromise, taxVariablesPromise, attendeesPromise]);

    if (!taxVariables) {
      return {
        rows: [],
        errors: ['Tax variables are not set'],
      };
    }

    if (!attendees?.length) {
      return {
        rows: [],
        errors: ['Attendees are not set'],
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
        daysCount,
        nightsCount,
      });
    });

    const errors: string[] = [];

    const [unAccommodatedDays] = await Promise.all([
      accommodationExpenseDataCollector(
        injector,
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
        flightExpenseDataCollector(injector, flightExpense, summaryData).catch(e => {
          if (e instanceof BusinessTripError) {
            errors.push(e.message);
          } else {
            console.error(`Error handling flight expenses`, e);
            throw new GraphQLError((e as Error)?.message ?? `Error handling flight expenses`);
          }
        }),
      ),
      otherExpensesDataCollector(injector, otherExpenses, summaryData).catch(e => {
        if (e instanceof BusinessTripError) {
          errors.push(e.message);
        } else {
          console.error(`Error handling other expenses`, e);
          throw new GraphQLError((e as Error)?.message ?? `Error handling other expenses`);
        }
      }),
      carRentalExpensesDataCollector(
        injector,
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
      injector,
      travelAndSubsistenceExpenses,
      summaryData,
      taxVariables,
      {
        destination: dbBusinessTrip.destination,
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
