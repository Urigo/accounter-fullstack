import { GraphQLScalarType } from 'graphql';
import { DateTimeResolver, URLResolver, UUIDResolver } from 'graphql-scalars';
import type { CommonModule } from '../types.js';
import { TimelessDateScalar } from './timeless-date.js';

export const scalarsResolvers: CommonModule.Resolvers = {
  DateTime: DateTimeResolver,
  URL: URLResolver,
  TimelessDate: TimelessDateScalar,
  UUID: UUIDResolver as GraphQLScalarType<string, string>,
  Query: {
    ping: () => true,
  },
};
