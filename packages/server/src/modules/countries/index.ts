import { createModule } from 'graphql-modules';
import { CountriesProvider } from './providers/countries.provider.js';
import { countriesResolvers } from './resolvers/countries.resolver.js';
import countries from './typeDefs/countries.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const countriesModule = createModule({
  id: 'countries',
  dirname: __dirname,
  typeDefs: [countries],
  resolvers: [countriesResolvers],
  providers: () => [CountriesProvider],
});

export * as CountriesTypes from './types.js';
