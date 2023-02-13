import { DateTimeResolver, IBANResolver, URLResolver } from 'graphql-scalars';
import { Resolvers } from '../../../__generated__/types.mjs';
import { PercentageScalar } from './percentage.mjs';
import { TimelessDateScalar } from './timeless-date.mjs';

export const scalarsResolvers: Partial<Resolvers> = {
  Date: DateTimeResolver,
  IBAN: IBANResolver,
  Percentage: PercentageScalar,
  URL: URLResolver,
  TimelessDate: TimelessDateScalar,
};
