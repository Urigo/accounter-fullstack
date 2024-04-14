import { format } from 'date-fns';
import type { TimelessDateString } from '@shared/types';
import { BusinessTripAttendeesProvider } from '../providers/business-trips-attendees.provider.js';
import type { BusinessTripsModule } from '../types.js';

export const businessTripAttendeesResolvers: BusinessTripsModule.Resolvers = {
  Mutation: {
    insertBusinessTripAttendee: async (_, { fields }, { injector }) => {
      return injector
        .get(BusinessTripAttendeesProvider)
        .addBusinessTripAttendees({
          businessId: fields.attendeeId,
          businessTripId: fields.businessTripId,
          arrival: fields.arrivalDate,
          departure: fields.departureDate,
        })
        .then(res => res[0].attendee_business_id);
    },
    updateBusinessTripAttendee: async (_, { fields }, { injector }) => {
      return injector
        .get(BusinessTripAttendeesProvider)
        .updateBusinessTripAttendee({
          attendeeBusinessId: fields.attendeeId,
          businessTripId: fields.businessTripId,
          arrival: fields.arrivalDate,
          departure: fields.departureDate,
        })
        .then(res => res[0].attendee_business_id);
    },
    deleteBusinessTripAttendee: async (_, { fields }, { injector }) => {
      return injector
        .get(BusinessTripAttendeesProvider)
        .removeBusinessTripAttendees({
          businessId: fields.attendeeId,
          businessTripId: fields.businessTripId,
        })
        .then(res => !!res[0].attendee_business_id);
    },
  },
  BusinessTripAttendee: {
    id: dbBusinessTripAttendee => dbBusinessTripAttendee.id,
    name: dbBusinessTripAttendee => dbBusinessTripAttendee.name,
    business: dbBusinessTripAttendee => dbBusinessTripAttendee,
    arrivalDate: dbBusinessTripAttendee =>
      dbBusinessTripAttendee.arrival
        ? (format(dbBusinessTripAttendee.arrival, 'yyyy-MM-dd') as TimelessDateString)
        : null,
    departureDate: dbBusinessTripAttendee =>
      dbBusinessTripAttendee.departure
        ? (format(dbBusinessTripAttendee.departure, 'yyyy-MM-dd') as TimelessDateString)
        : null,
  },
};
