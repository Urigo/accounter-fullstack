import businessTripAtendees from './typeDefs/business-trip-attendees.graphql.js';
import businessTripTransactions from './typeDefs/business-trip-transactions.graphql.js';
import businessTrips from './typeDefs/business-trips.graphql.js';
import { createModule } from 'graphql-modules';
import { BusinessTripAttendeesProvider } from './providers/business-trips-attendees.provider.js';
import { BusinessTripEmployeePaymentsProvider } from './providers/business-trips-employee-payments.provider.js';
import { BusinessTripAccommodationsTransactionsProvider } from './providers/business-trips-transactions-accommodations.provider.js';
import { BusinessTripFlightsTransactionsProvider } from './providers/business-trips-transactions-flights.provider.js';
import { BusinessTripOtherTransactionsProvider } from './providers/business-trips-transactions-other.provider.js';
import { BusinessTripTravelAndSubsistenceTransactionsProvider } from './providers/business-trips-transactions-travel-and-subsistence.provider.js';
import { BusinessTripTransactionsProvider } from './providers/business-trips-transactions.provider.js';
import { BusinessTripsProvider } from './providers/business-trips.provider.js';
import { businessTripAttendeesResolvers } from './resolvers/business-trip-attendees.resolver.js';
import { businessTripTransactionsResolvers } from './resolvers/business-trips-transactions.resolver.js';
import { businessTripsResolvers } from './resolvers/business-trips.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const businessTripsModule = createModule({
  id: 'businessTrips',
  dirname: __dirname,
  typeDefs: [businessTrips, businessTripAtendees, businessTripTransactions],
  resolvers: [
    businessTripsResolvers,
    businessTripAttendeesResolvers,
    businessTripTransactionsResolvers,
  ],
  providers: () => [
    BusinessTripsProvider,
    BusinessTripTransactionsProvider,
    BusinessTripFlightsTransactionsProvider,
    BusinessTripAccommodationsTransactionsProvider,
    BusinessTripTravelAndSubsistenceTransactionsProvider,
    BusinessTripOtherTransactionsProvider,
    BusinessTripAttendeesProvider,
    BusinessTripEmployeePaymentsProvider,
  ],
});

export * as BusinessTripsTypes from './types.js';
