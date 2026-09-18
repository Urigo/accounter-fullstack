import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { QueueMatchEvaluatorProvider } from '../providers/queue-match-evaluator.provider.js';
import type { ChargesMatcherModule } from '../types.js';
import { autoMatchChargesResolver } from './auto-match-charges.resolver.js';
import { chargesAwaitingMatchQueueResolver } from './charges-awaiting-match-queue.resolver.js';
import { findChargeMatchesResolver } from './find-charge-matches.resolver.js';

export const chargesMatcherResolvers: ChargesMatcherModule.Resolvers = {
  Query: {
    ...findChargeMatchesResolver.Query,
    ...chargesAwaitingMatchQueueResolver.Query,
  },
  Mutation: {
    ...autoMatchChargesResolver.Mutation,
  },
  ChargeMatch: {
    charge: async ({ chargeId }, _args, { injector }) =>
      injector
        .get(ChargesProvider)
        .getChargeByIdLoader.load(chargeId)
        .then(res => {
          if (!res) {
            throw new Error(`Charge ID="${chargeId}" not found`);
          }
          return res;
        }),
  },
  ChargeWithSuggestions: {
    // Lazily scored so the queue can return base charges immediately and stream
    // suggestions via @defer. `BY_SCORE` precomputes them (needed for the sort)
    // and carries them on the parent, so we return those directly when present.
    suggestions: (parent, _args, { injector }) =>
      parent.suggestions ??
      injector.get(QueueMatchEvaluatorProvider).suggestionsByChargeIdLoader.load(parent.id),
  },
};
