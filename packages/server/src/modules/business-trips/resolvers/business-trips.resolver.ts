import { format } from 'date-fns';
import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { IGetTransactionsByIdsResult } from '@modules/transactions/types.js';
import { BusinessTripSummaryCategories } from '@shared/gql-types';
import { TimelessDateString } from '@shared/types';
import {
  calculateTotalReportSummaryCategory,
  convertSummaryCategoryDataToRow,
  summaryCategoryDataCollector,
  SummaryData,
} from '../helpers/business-trip-report.helper.js';
import { BusinessTripAttendeesProvider } from '../providers/business-trips-attendees.provider.js';
import { BusinessTripTransactionsProvider } from '../providers/business-trips-transactions.provider.js';
import { BusinessTripsProvider } from '../providers/business-trips.provider.js';
import type {
  BusinessTripsModule,
  currency,
  IGetBusinessTripsTransactionsByBusinessTripIdsResult,
} from '../types.js';
import { commonBusinessTransactionFields, commonChargeFields } from './common.js';

export const businessTripsResolvers: BusinessTripsModule.Resolvers = {
  Query: {
    allBusinessTrips: async (_, __, { injector }) => {
      try {
        return injector.get(BusinessTripsProvider).getAllBusinessTrips();
      } catch (e) {
        console.error('Error fetching business trips', e);
        throw new GraphQLError((e as Error)?.message ?? 'Error fetching business trips');
      }
    },
    businessTrip: async (_, { id }, { injector }) => {
      try {
        return injector
          .get(BusinessTripsProvider)
          .getBusinessTripsByIdLoader.load(id)
          .then(businessTrip => businessTrip ?? null);
      } catch (e) {
        console.error('Error fetching business trips', e);
        throw new GraphQLError((e as Error)?.message ?? 'Error fetching business trips');
      }
    },
  },
  Mutation: {
    updateChargeBusinessTrip: async (_, { chargeId, businessTripId = null }, { injector }) => {
      try {
        const [updatedChargeId] = await injector
          .get(BusinessTripsProvider)
          .updateChargeBusinessTrip(chargeId, businessTripId);
        if (updatedChargeId) {
          return injector
            .get(ChargesProvider)
            .getChargeByIdLoader.load(updatedChargeId.charge_id)
            .then(charge => {
              if (charge) {
                return charge;
              }
              throw new Error(`Updated charge with id ${updatedChargeId} not found`);
            });
        }
        throw new Error();
      } catch (e) {
        console.error(`Error updating charge's business trip`, e);
        throw new GraphQLError((e as Error)?.message ?? `Error updating charge's business trip`);
      }
    },
    insertBusinessTrip: async (_, { fields }, { injector }) => {
      // fields validation
      if (!fields.name) {
        throw new GraphQLError(`Business trip name is required`);
      }

      try {
        return injector
          .get(BusinessTripsProvider)
          .insertBusinessTrip(fields)
          .then(result => result[0]);
      } catch (e) {
        console.error(`Error inserting business trip`, e);
        throw new GraphQLError((e as Error)?.message ?? `Error inserting business trip`);
      }
    },
    updateBusinessTrip: async (_, { fields }, { injector }) => {
      try {
        return injector
          .get(BusinessTripsProvider)
          .insertBusinessTrip(fields)
          .then(result => result[0]);
      } catch (e) {
        console.error(`Error updating business trip`, e);
        throw new GraphQLError((e as Error)?.message ?? `Error inserting business trip`);
      }
    },
  },
  BusinessTrip: {
    id: dbBusinessTrip => dbBusinessTrip.id,
    name: dbBusinessTrip => dbBusinessTrip.name,
    dates: dbBusinessTrip => {
      if (!dbBusinessTrip.from_date || !dbBusinessTrip.to_date) {
        return null;
      }
      return {
        start: format(dbBusinessTrip.from_date, 'yyyy-MM-dd') as TimelessDateString,
        end: format(dbBusinessTrip.to_date, 'yyyy-MM-dd') as TimelessDateString,
      };
    },
    purpose: dbBusinessTrip => dbBusinessTrip.trip_purpose,
    destination: dbBusinessTrip => dbBusinessTrip.destination,
    attendees: async (dbBusinessTrip, _, { injector }) => {
      return injector
        .get(BusinessTripAttendeesProvider)
        .getBusinessTripsAttendeesByBusinessTripIdLoader.load(dbBusinessTrip.id);
    },
    transactions: async (dbBusinessTrip, _, { injector }) => {
      try {
        const {
          nonExtendedTransactions,
          flightTransactions,
          accommodationsTransactions,
          travelAndSubsistenceTransactions,
          otherTransactions,
        } = await injector
          .get(BusinessTripTransactionsProvider)
          .getBusinessTripExtendedTransactionsByBusinessTripId(dbBusinessTrip.id);
        return [
          ...nonExtendedTransactions,
          ...flightTransactions,
          ...accommodationsTransactions,
          ...travelAndSubsistenceTransactions,
          ...otherTransactions,
        ];
      } catch (e) {
        console.error(`Error fetching business trip transactions`, e);
        throw new GraphQLError(
          (e as Error)?.message ?? `Error fetching business trip transactions`,
        );
      }
    },
    summary: async (dbBusinessTrip, _, { injector }) => {
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
            res =>
              res.filter(t => t && t instanceof Error === false) as IGetTransactionsByIdsResult[],
          );

        const summaryData: Partial<SummaryData> = {};

        const categoryDataCollector =
          (categoryName: BusinessTripSummaryCategories) =>
          (businessTripTransactions: IGetBusinessTripsTransactionsByBusinessTripIdsResult) =>
            summaryCategoryDataCollector(
              businessTripTransactions,
              summaryData,
              categoryName,
              transactions,
            );

        await Promise.all([
          ...flightTransactions.map(categoryDataCollector('FLIGHT')),
          ...accommodationsTransactions.map(categoryDataCollector('ACCOMMODATION')),
          ...travelAndSubsistenceTransactions.map(categoryDataCollector('TRAVEL_AND_SUBSISTENCE')),
          ...otherTransactions.map(categoryDataCollector('OTHER')),
        ]);

        const totalSumCategory = calculateTotalReportSummaryCategory(summaryData);
        summaryData['TOTAL'] = totalSumCategory;

        return {
          rows: Object.entries(summaryData).map(([category, data]) =>
            convertSummaryCategoryDataToRow(category as BusinessTripSummaryCategories, data),
          ),
        };
      } catch (e) {
        console.error(`Error fetching business trip transactions`, e);
        throw new GraphQLError(
          (e as Error)?.message ?? `Error fetching business trip transactions`,
        );
      }
    },
  },
  BusinessTripUncategorizedTransaction: {
    __isTypeOf: DbTransaction => !DbTransaction.category,
    ...commonBusinessTransactionFields,
  },
  BusinessTripAccommodationTransaction: {
    __isTypeOf: DbTransaction => DbTransaction.category === 'ACCOMMODATION',
    ...commonBusinessTransactionFields,
    country: dbTransaction => dbTransaction.country,
    nightsCount: dbTransaction => dbTransaction.nights_count,
  },
  BusinessTripFlightTransaction: {
    __isTypeOf: DbTransaction => DbTransaction.category === 'FLIGHT',
    ...commonBusinessTransactionFields,
    origin: dbTransaction => dbTransaction.origin,
    destination: dbTransaction => dbTransaction.destination,
    class: dbTransaction => dbTransaction.class,
  },
  BusinessTripTravelAndSubsistenceTransaction: {
    __isTypeOf: DbTransaction => DbTransaction.category === 'TRAVEL_AND_SUBSISTENCE',
    ...commonBusinessTransactionFields,
    expenseType: dbTransaction => dbTransaction.expense_type,
  },
  BusinessTripOtherTransaction: {
    __isTypeOf: DbTransaction => DbTransaction.category === 'OTHER',
    ...commonBusinessTransactionFields,
    expenseType: dbTransaction => dbTransaction.expense_type,
  },
  CommonCharge: {
    ...commonChargeFields,
  },
  ConversionCharge: {
    ...commonChargeFields,
  },
  SalaryCharge: {
    ...commonChargeFields,
  },
  InternalTransferCharge: {
    ...commonChargeFields,
  },
  DividendCharge: {
    ...commonChargeFields,
  },
  BusinessTripCharge: {
    ...commonChargeFields,
  },
  MonthlyVatCharge: {
    ...commonChargeFields,
  },
  BankDepositCharge: {
    ...commonChargeFields,
  },
};
