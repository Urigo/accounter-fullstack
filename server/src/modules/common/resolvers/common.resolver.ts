import { DateTimeResolver, IBANResolver, URLResolver } from 'graphql-scalars';
import type { CommonModule } from '../types.js';
import { PercentageScalar } from './percentage.js';
import { TimelessDateScalar } from './timeless-date.js';

export const scalarsResolvers: CommonModule.Resolvers = {
  Date: DateTimeResolver,
  IBAN: IBANResolver,
  Percentage: PercentageScalar,
  URL: URLResolver,
  TimelessDate: TimelessDateScalar,
};
