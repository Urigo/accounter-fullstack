import { DateTimeResolver, IBANResolver, URLResolver } from 'graphql-scalars';
import { Resolvers } from '../../__generated__/types.mjs';
import { TimelessDateScalar } from '../scalars/timeless-date.mjs';
import { Percentage } from './percentage.mjs';

export const scalarsResolvers: Partial<Resolvers> = {
  Date: DateTimeResolver,
  IBAN: IBANResolver,
  Percentage,
  URL: URLResolver,
  TimelessDate: TimelessDateScalar,
};
