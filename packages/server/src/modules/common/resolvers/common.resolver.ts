import { GraphQLScalarType } from 'graphql';
import { DateTimeResolver, IBANResolver, URLResolver, UUIDResolver } from 'graphql-scalars';
import type { CommonModule } from '../types.js';
import { TimelessDateScalar } from './timeless-date.js';

export const scalarsResolvers: CommonModule.Resolvers = {
  Date: DateTimeResolver,
  IBAN: IBANResolver,
  URL: URLResolver,
  TimelessDate: TimelessDateScalar,
  UUID: UUIDResolver as GraphQLScalarType<string, string>,
  Query: {
    ping: () => true,
  },
};
