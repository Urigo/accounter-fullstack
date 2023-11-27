import { GraphQLError } from 'graphql';
import { BusinessTripsProvider } from '../providers/business-trips.provider.js';
import type { BusinessTripsModule } from '../types.js';

export const commonChargeFields: BusinessTripsModule.ChargeResolvers = {
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
};
