import type { CommonModule } from '../types.js';
import { PercentageScalar } from './percentage.js';
import { TimelessDateScalar } from './timeless-date.js';
import { GraphQLScalarType } from 'graphql';
import { DateTimeResolver, IBANResolver, URLResolver, UUIDResolver } from 'graphql-scalars';

export const scalarsResolvers: CommonModule.Resolvers = {
  Date: DateTimeResolver,
  IBAN: IBANResolver,
  Percentage: PercentageScalar,
  URL: URLResolver,
  TimelessDate: TimelessDateScalar,
  UUID: UUIDResolver as GraphQLScalarType<string, string>,
};
