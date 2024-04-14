import { differenceInDays } from 'date-fns';
import { GraphQLError } from 'graphql';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { IGetTransactionsByIdsResult } from '@modules/transactions/types.js';
import type { BusinessTripSummaryCategories } from '@shared/gql-types';
import {
  accommodationTransactionDataCollector,
  calculateTotalReportSummaryCategory,
  convertSummaryCategoryDataToRow,
  flightTransactionDataCollector,
  onlyUnique,
  otherTransactionsDataCollector,
  SummaryData,
} from '../helpers/business-trip-report.helper.js';
import { BusinessTripTransactionsProvider } from '../providers/business-trips-transactions.provider.js';
import type { BusinessTripsModule } from '../types.js';

export const businessTripSummary: BusinessTripsModule.BusinessTripResolvers['summary'] = async (
  dbBusinessTrip,
  _,
  { injector },
) => {
  try {
    const {
      flightTransactions,
      accommodationsTransactions,
      travelAndSubsistenceTransactions,
      otherTransactions,
    } = await injector
      .get(BusinessTripTransactionsProvider)
      .getBusinessTripExtendedTransactionsByBusinessTripId(dbBusinessTrip.id);

    const transactions = await injector
      .get(TransactionsProvider)
      .getTransactionByIdLoader.loadMany(
        Array.from(
          new Set(
            [
              ...flightTransactions,
              ...accommodationsTransactions,
              ...travelAndSubsistenceTransactions,
              ...otherTransactions,
            ].map(t => t.transaction_id),
          ),
        ).filter(Boolean) as string[],
      )
      .then(
        res => res.filter(t => t && t instanceof Error === false) as IGetTransactionsByIdsResult[],
      );

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
      ...flightTransactions.map(flightTransaction =>
        flightTransactionDataCollector(injector, flightTransaction, summaryData, transactions).then(
          res => {
            if (res && typeof res === 'string') {
              errors.push(res);
            }
          },
        ),
      ),
      ...accommodationsTransactions.map(accommodationsTransaction =>
        accommodationTransactionDataCollector(
          injector,
          accommodationsTransaction,
          summaryData,
          transactions,
          dbBusinessTrip.destination,
        ).then(res => {
          if (res && typeof res === 'string') {
            errors.push(res);
          }
        }),
      ),
      otherTransactionsDataCollector(
        injector,
        [...travelAndSubsistenceTransactions, ...otherTransactions],
        summaryData,
        transactions,
        {
          tripDuration,
          hasAccommodationExpenses: accommodationsTransactions.length > 0,
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
    console.error(`Error fetching business trip transactions`, e);
    throw new GraphQLError((e as Error)?.message ?? `Error fetching business trip transactions`);
  }
};
