import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { IGetTransactionsByIdsResult } from '@modules/transactions/types.js';
import { dateToTimelessDateString } from '@shared/helpers';
import { BusinessTripAttendeesProvider } from '../providers/business-trips-attendees.provider.js';
import { BusinessTripAccommodationsTransactionsProvider } from '../providers/business-trips-transactions-accommodations.provider.js';
import { BusinessTripFlightsTransactionsProvider } from '../providers/business-trips-transactions-flights.provider.js';
import { BusinessTripOtherTransactionsProvider } from '../providers/business-trips-transactions-other.provider.js';
import { BusinessTripTravelAndSubsistenceTransactionsProvider } from '../providers/business-trips-transactions-travel-and-subsistence.provider.js';
import { BusinessTripTransactionsProvider } from '../providers/business-trips-transactions.provider.js';
import { BusinessTripsProvider } from '../providers/business-trips.provider.js';
import type { BusinessTripsModule } from '../types.js';
import { businessTripSummary } from './business-trip-summary.resolver.js';
import { commonBusinessTransactionFields } from './common.js';

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
    flightTransactions: async (dbBusinessTrip, _, { injector }) => {
      return injector
        .get(BusinessTripFlightsTransactionsProvider)
        .getBusinessTripsFlightsTransactionsByBusinessTripIdLoader.load(dbBusinessTrip.id);
    },
    accommodationTransactions: async (dbBusinessTrip, _, { injector }) => {
      return injector
        .get(BusinessTripAccommodationsTransactionsProvider)
        .getBusinessTripsAccommodationsTransactionsByBusinessTripIdLoader.load(dbBusinessTrip.id);
    },
    travelAndSubsistenceTransactions: async (dbBusinessTrip, _, { injector }) => {
      return injector
        .get(BusinessTripTravelAndSubsistenceTransactionsProvider)
        .getBusinessTripsTravelAndSubsistenceTransactionsByBusinessTripIdLoader.load(
          dbBusinessTrip.id,
        );
    },
    otherTransactions: async (dbBusinessTrip, _, { injector }) => {
      return injector
        .get(BusinessTripOtherTransactionsProvider)
        .getBusinessTripsOtherTransactionsByBusinessTripIdLoader.load(dbBusinessTrip.id);
    },
    summary: businessTripSummary,
    uncategorizedTransactions: async (dbBusinessTrip, _, { injector }) => {
      return injector
        .get(BusinessTripTransactionsProvider)
        .getUncategorizedTransactionsByBusinessTripId({ businessTripId: dbBusinessTrip.id })
        .then(res => res as IGetTransactionsByIdsResult[]);
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
