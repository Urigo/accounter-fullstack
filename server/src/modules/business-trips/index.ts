import businessTrips from './typeDefs/business-trips.graphql.js';
import { createModule } from 'graphql-modules';
import { BusinessTripAccommodationsTransactionsProvider } from './providers/business-trips-transactions-accommodations.provider.js';
import { BusinessTripFlightsTransactionsProvider } from './providers/business-trips-transactions-flights.provider.js';
import { BusinessTripOtherTransactionsProvider } from './providers/business-trips-transactions-other.provider.js';
import { BusinessTripTravelAndSubsistenceTransactionsProvider } from './providers/business-trips-transactions-travel-and-subsistence.provider.js';
import { BusinessTripTransactionsProvider } from './providers/business-trips-transactions.provider.js';
import { BusinessTripsProvider } from './providers/business-trips.provider.js';
import { businessTripsResolvers } from './resolvers/business-trips.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const businessTripsModule = createModule({
  id: 'businessTrips',
  dirname: __dirname,
  typeDefs: [businessTrips],
  resolvers: [businessTripsResolvers],
  providers: () => [
    BusinessTripsProvider,
    BusinessTripTransactionsProvider,
    BusinessTripFlightsTransactionsProvider,
    BusinessTripAccommodationsTransactionsProvider,
    BusinessTripTravelAndSubsistenceTransactionsProvider,
    BusinessTripOtherTransactionsProvider,
  ],
});

export * as BusinessTripsTypes from './types.js';
