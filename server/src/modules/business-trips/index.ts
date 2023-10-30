import businessTrips from './typeDefs/business-trips.graphql.js';
import { createModule } from 'graphql-modules';
import { BusinessTripsProvider } from './providers/business-trips.provider.js';
import { businessTripsResolvers } from './resolvers/business-trips.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const businessTripsModule = createModule({
  id: 'businessTrips',
  dirname: __dirname,
  typeDefs: [businessTrips],
  resolvers: [businessTripsResolvers],
  providers: () => [BusinessTripsProvider],
});

export * as BusinessTripsTypes from './types.js';
