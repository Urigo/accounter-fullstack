import type { ChargesMatcherModule } from '../types.js';
import { autoMatchChargesResolver } from './auto-match-charges.resolver.js';
import { findChargeMatchesResolver } from './find-charge-matches.resolver.js';

export const chargesMatcherResolvers: ChargesMatcherModule.Resolvers = {
  Query: {
    ...findChargeMatchesResolver.Query,
  },
  Mutation: {
    ...autoMatchChargesResolver.Mutation,
  },
  ChargeMatch: {
    charge: ({ chargeId }) => chargeId,
  },
};
