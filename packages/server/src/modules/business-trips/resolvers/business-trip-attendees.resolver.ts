import type { BusinessTripAttendeeStayInput } from '../../../__generated__/types.js';
import { IGetBusinessesByIdsResult } from '../../../modules/financial-entities/types.js';
import { optionalDateToTimelessDateString } from '../../../shared/helpers/index.js';
import { BusinessTripAttendeesProvider } from '../providers/business-trips-attendees.provider.js';
import { BusinessTripAccommodationsExpensesProvider } from '../providers/business-trips-expenses-accommodations.provider.js';
import { BusinessTripFlightsExpensesProvider } from '../providers/business-trips-expenses-flights.provider.js';
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
    business: dbBusinessTripAttendee =>
      dbBusinessTripAttendee as unknown as IGetBusinessesByIdsResult, // TODO: temporary type casting, should be fixed later
    arrivalDate: dbBusinessTripAttendee =>
      optionalDateToTimelessDateString(dbBusinessTripAttendee.arrival),
    departureDate: dbBusinessTripAttendee =>
      optionalDateToTimelessDateString(dbBusinessTripAttendee.departure),
    flights: async (dbBusinessTripAttendee, _, { injector }) =>
      injector
        .get(BusinessTripFlightsExpensesProvider)
        .getBusinessTripsFlightsExpensesByBusinessTripIdLoader.load(
          dbBusinessTripAttendee.business_trip_id,
        )
        .then(res => res.filter(expense => expense.attendees.includes(dbBusinessTripAttendee.id))),
    accommodations: async (dbBusinessTripAttendee, _, { injector }) =>
      injector
        .get(BusinessTripAccommodationsExpensesProvider)
        .getBusinessTripsAccommodationsExpensesByBusinessTripIdLoader.load(
          dbBusinessTripAttendee.business_trip_id,
        )
        .then(res => {
          return res.filter(expense =>
            expense.attendees_stay
              .values()
              .some(
                stay =>
                  (stay as BusinessTripAttendeeStayInput).attendeeId === dbBusinessTripAttendee.id,
              ),
          );
        }),
  },
};
