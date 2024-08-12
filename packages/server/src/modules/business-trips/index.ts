import businessTripAttendees from './typeDefs/business-trip-attendees.graphql.js';
import businessTripExpenses from './typeDefs/business-trip-expenses.graphql.js';
import businessTrips from './typeDefs/business-trips.graphql.js';
import { createModule } from 'graphql-modules';
import { BusinessTripAttendeesProvider } from './providers/business-trips-attendees.provider.js';
import { BusinessTripEmployeePaymentsProvider } from './providers/business-trips-employee-payments.provider.js';
import { BusinessTripAccommodationsExpensesProvider } from './providers/business-trips-expenses-accommodations.provider.js';
import { BusinessTripFlightsExpensesProvider } from './providers/business-trips-expenses-flights.provider.js';
import { BusinessTripOtherExpensesProvider } from './providers/business-trips-expenses-other.provider.js';
import { BusinessTripTravelAndSubsistenceExpensesProvider } from './providers/business-trips-expenses-travel-and-subsistence.provider.js';
import { BusinessTripExpensesProvider } from './providers/business-trips-expenses.provider.js';
import { BusinessTripsProvider } from './providers/business-trips.provider.js';
import { businessTripAttendeesResolvers } from './resolvers/business-trip-attendees.resolver.js';
import { businessTripExpensesResolvers } from './resolvers/business-trips-expenses.resolver.js';
import { businessTripsResolvers } from './resolvers/business-trips.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const businessTripsModule = createModule({
  id: 'businessTrips',
  dirname: __dirname,
  typeDefs: [businessTrips, businessTripAttendees, businessTripExpenses],
  resolvers: [
    businessTripsResolvers,
    businessTripAttendeesResolvers,
    businessTripExpensesResolvers,
  ],
  providers: () => [
    BusinessTripsProvider,
    BusinessTripExpensesProvider,
    BusinessTripFlightsExpensesProvider,
    BusinessTripAccommodationsExpensesProvider,
    BusinessTripTravelAndSubsistenceExpensesProvider,
    BusinessTripOtherExpensesProvider,
    BusinessTripAttendeesProvider,
    BusinessTripEmployeePaymentsProvider,
  ],
});

export * as BusinessTripsTypes from './types.js';
