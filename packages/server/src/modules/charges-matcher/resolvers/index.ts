import { ChargesProvider } from '../../../modules/charges/providers/charges.provider.js';
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
    charge: async ({ chargeId }, _args, { injector }) =>
      injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId),
  },
};
