import { GraphQLError } from 'graphql';
import { CountryCode } from '../../../shared/enums.js';
import { CountriesProvider } from '../providers/countries.provider.js';
import type { CountriesModule } from '../types.js';

export const countriesResolvers: CountriesModule.Resolvers = {
  Query: {
    allCountries: async (_, __, { injector }) => {
      try {
        return (await injector.get(CountriesProvider).getAllCountries()).map(
          country => country.code as CountryCode,
        );
      } catch (e) {
        console.error('Error fetching countries', e);
        throw new GraphQLError('Error fetching countries');
      }
    },
  },
  Country: {
    id: countryCode => countryCode,
    name: async (countryCode, __, { injector }) =>
      injector
        .get(CountriesProvider)
        .getCountryByCodeLoader.load(countryCode)
        .catch(error => {
          console.error('Error fetching countries', error);
          throw new GraphQLError('Error fetching countries');
        })
        .then(country => {
          if (!country) {
            throw new GraphQLError(`Country not found for code: ${countryCode}`);
          }
          return country.name;
        }),
    code: countryCode => countryCode,
  },
};
