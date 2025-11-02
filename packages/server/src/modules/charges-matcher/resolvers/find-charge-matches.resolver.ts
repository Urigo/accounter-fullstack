import { GraphQLError } from 'graphql';
import { ChargesMatcherProvider } from '../providers/charges-matcher.provider.js';
import type { ChargesMatcherModule } from '../types.js';

export const findChargeMatchesResolver: ChargesMatcherModule.Resolvers = {
  Query: {
    findChargeMatches: async (_, { chargeId }, context) => {
      try {
        const result = await context.injector
          .get(ChargesMatcherProvider)
          .findMatchesForCharge(chargeId, context);
        return result;
      } catch (e) {
        if (e instanceof GraphQLError) {
          throw e;
        }
        const message =
          (e as Error)?.message ??
          (e as { errors: Error[] })?.errors.map(e => e.message).toString() ??
          'Unknown error';
        throw new GraphQLError(message);
      }
    },
  },
};
