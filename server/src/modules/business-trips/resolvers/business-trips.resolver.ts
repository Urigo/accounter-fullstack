import { format } from 'date-fns';
import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { TimelessDateString } from '@shared/types';
import { BusinessTripsProvider } from '../providers/business-trips.provider.js';
import type { BusinessTripsModule } from '../types.js';
import { commonChargeFields } from './common.js';

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
};
