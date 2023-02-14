import businessTrip from './typeDefs/business-trip.graphql.js';
import { createModule } from 'graphql-modules';

const __dirname = new URL('.', import.meta.url).pathname;

export const businessTripModule = createModule({
  id: 'businessTrip',
  dirname: __dirname,
  typeDefs: [businessTrip],
});
