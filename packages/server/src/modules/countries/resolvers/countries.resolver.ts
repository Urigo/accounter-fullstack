import { GraphQLError } from 'graphql';
import { CountriesProvider } from '../providers/countries.provider.js';
import type { CountriesModule } from '../types.js';

export const countriesResolvers: CountriesModule.Resolvers = {
  Query: {
    allCountries: async (_, __, { injector }) => {
      try {
        return injector.get(CountriesProvider).getAllCountries();
      } catch (e) {
        console.error('Error fetching countries', e);
        throw new GraphQLError('Error fetching countries');
      }
    },
  },
  Country: {
    id: dbCountry => dbCountry.code,
    name: dbCountry => dbCountry.name,
    code: dbCountry => dbCountry.code,
  },
};
