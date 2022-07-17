import { CommonModule } from '../generated-types/graphql';
import { TimelessDateScalar } from './timeless-date.mjs';

export const resolvers: CommonModule.Resolvers = {
  TimelessDate: TimelessDateScalar,
};
