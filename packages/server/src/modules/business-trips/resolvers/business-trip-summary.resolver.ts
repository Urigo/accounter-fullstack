import { differenceInDays } from 'date-fns';
import { GraphQLError } from 'graphql';
import type { BusinessTripSummaryCategories } from '@shared/gql-types';
import {
  accommodationExpenseDataCollector,
  calculateTotalReportSummaryCategory,
  convertSummaryCategoryDataToRow,
  flightExpenseDataCollector,
  onlyUnique,
  otherExpensesDataCollector,
  SummaryData,
} from '../helpers/business-trip-report.helper.js';
import { BusinessTripExpensesProvider } from '../providers/business-trips-expenses.provider.js';
import type { BusinessTripsModule } from '../types.js';

export const businessTripSummary: BusinessTripsModule.BusinessTripResolvers['summary'] = async (
  dbBusinessTrip,
  _,
  { injector },
) => {
  try {
    const { flightExpenses, accommodationsExpenses, travelAndSubsistenceExpenses, otherExpenses } =
      await injector
        .get(BusinessTripExpensesProvider)
        .getBusinessTripExtendedExpensesByBusinessTripId(dbBusinessTrip.id);

    const summaryData: Partial<SummaryData> = {};

    if (!dbBusinessTrip.from_date || !dbBusinessTrip.to_date) {
      return {
        rows: [],
        errors: ['Business trip dates are not set'],
      };
    }
    const tripDuration = Math.abs(
      differenceInDays(dbBusinessTrip.from_date, dbBusinessTrip.to_date),
    );

    const errors: string[] = [];

    await Promise.all([
      ...flightExpenses.map(flightExpense =>
        flightExpenseDataCollector(injector, flightExpense, summaryData).then(res => {
          if (res && typeof res === 'string') {
            errors.push(res);
          }
        }),
      ),
      ...accommodationsExpenses.map(accommodationsExpense =>
        accommodationExpenseDataCollector(
          injector,
          accommodationsExpense,
          summaryData,
          dbBusinessTrip.destination,
        ).then(res => {
          if (res && typeof res === 'string') {
            errors.push(res);
          }
        }),
      ),
      otherExpensesDataCollector(
        injector,
        [...travelAndSubsistenceExpenses, ...otherExpenses],
        summaryData,
        {
          tripDuration,
          hasAccommodationExpenses: accommodationsExpenses.length > 0,
          destination: dbBusinessTrip.destination,
          endDate: dbBusinessTrip.to_date,
        },
      ).then(res => {
        if (res && typeof res === 'string') {
          errors.push(res);
        }
      }),
    ]);

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
};
