import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types.js';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import { getTransactionMatchedAmount } from '../helpers/business-trips-expenses.helper.js';
import { BusinessTripAttendeesProvider } from '../providers/business-trips-attendees.provider.js';
import { BusinessTripAccommodationsExpensesProvider } from '../providers/business-trips-expenses-accommodations.provider.js';
import { BusinessTripCarRentalExpensesProvider } from '../providers/business-trips-expenses-car-rental.provider.js';
import { BusinessTripFlightsExpensesProvider } from '../providers/business-trips-expenses-flights.provider.js';
import { BusinessTripOtherExpensesProvider } from '../providers/business-trips-expenses-other.provider.js';
import { BusinessTripTravelAndSubsistenceExpensesProvider } from '../providers/business-trips-expenses-travel-and-subsistence.provider.js';
import { BusinessTripExpensesProvider } from '../providers/business-trips-expenses.provider.js';
import { BusinessTripsProvider } from '../providers/business-trips.provider.js';
import type { BusinessTripsModule } from '../types.js';
import { businessTripSummary } from './business-trip-summary.resolver.js';

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
          .then(result => result[0]?.id);
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
          .then(result => result[0]?.id);
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
        start: dateToTimelessDateString(dbBusinessTrip.from_date),
        end: dateToTimelessDateString(dbBusinessTrip.to_date),
      };
    },
    purpose: dbBusinessTrip => dbBusinessTrip.trip_purpose,
    destination: dbBusinessTrip => dbBusinessTrip.destination,
    attendees: async (dbBusinessTrip, _, { injector }) => {
      return injector
        .get(BusinessTripAttendeesProvider)
        .getBusinessTripsAttendeesByBusinessTripIdLoader.load(dbBusinessTrip.id);
    },
    flightExpenses: async (dbBusinessTrip, _, { injector }) => {
      return injector
        .get(BusinessTripFlightsExpensesProvider)
        .getBusinessTripsFlightsExpensesByBusinessTripIdLoader.load(dbBusinessTrip.id);
    },
    accommodationExpenses: async (dbBusinessTrip, _, { injector }) => {
      return injector
        .get(BusinessTripAccommodationsExpensesProvider)
        .getBusinessTripsAccommodationsExpensesByBusinessTripIdLoader.load(dbBusinessTrip.id);
    },
    travelAndSubsistenceExpenses: async (dbBusinessTrip, _, { injector }) => {
      return injector
        .get(BusinessTripTravelAndSubsistenceExpensesProvider)
        .getBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdLoader.load(dbBusinessTrip.id);
    },
    otherExpenses: async (dbBusinessTrip, _, { injector }) => {
      return injector
        .get(BusinessTripOtherExpensesProvider)
        .getBusinessTripsOtherExpensesByBusinessTripIdLoader.load(dbBusinessTrip.id);
    },
    carRentalExpenses: async (dbBusinessTrip, _, { injector }) => {
      return injector
        .get(BusinessTripCarRentalExpensesProvider)
        .getBusinessTripsCarRentalExpensesByBusinessTripIdLoader.load(dbBusinessTrip.id);
    },
    summary: businessTripSummary,
    uncategorizedTransactions: async (dbBusinessTrip, _, { injector }) => {
      const transactions = (await injector
        .get(BusinessTripExpensesProvider)
        .getTransactionsByBusinessTripId({
          businessTripId: dbBusinessTrip.id,
        })) as IGetTransactionsByChargeIdsResult[];

      const transactionCategorizeInfo = await Promise.all(
        transactions.map(async transaction => {
          const matchInfo = await getTransactionMatchedAmount(injector, transaction).catch(_ => ({
            isFullyMatched: false,
            amount: 0,
            errors: ["Error matching transaction's amount"],
          }));
          return {
            transaction,
            matchInfo,
          };
        }),
      );

      const uncategorizedTransactions = transactionCategorizeInfo.filter(({ matchInfo }) => {
        return !matchInfo.isFullyMatched;
      });

      return uncategorizedTransactions.map(({ transaction, matchInfo }) => ({
        transaction,
        categorizedAmount: formatFinancialAmount(matchInfo.amount, transaction.currency),
        errors: matchInfo.errors ?? [],
      }));
    },
  },
  BusinessTripCharge: {
    businessTrip: (dbCharge, _, { injector }) => {
      if (!dbCharge.business_trip_id) {
        return null;
      }
      try {
        return injector
          .get(BusinessTripsProvider)
          .getBusinessTripsByIdLoader.load(dbCharge.business_trip_id)
          .then(businessTrip => businessTrip ?? null);
      } catch (e) {
        console.error(`Error finding business trip for charge id ${dbCharge.id}:`, e);
        throw new GraphQLError(`Error finding business trip for charge id ${dbCharge.id}`);
      }
    },
  },
};
