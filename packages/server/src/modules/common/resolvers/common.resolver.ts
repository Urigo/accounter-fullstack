import { GraphQLScalarType } from 'graphql';
import { BigIntResolver, DateTimeResolver, URLResolver, UUIDResolver } from 'graphql-scalars';
import type { CommonModule } from '../types.js';
import { TimelessDateScalar } from './timeless-date.js';

export const scalarsResolvers: CommonModule.Resolvers = {
  DateTime: DateTimeResolver,
  URL: URLResolver,
  TimelessDate: TimelessDateScalar,
  UUID: UUIDResolver as GraphQLScalarType<string, string>,
  BigInt: BigIntResolver,
  Query: {
    ping: () => true,
  },
};
