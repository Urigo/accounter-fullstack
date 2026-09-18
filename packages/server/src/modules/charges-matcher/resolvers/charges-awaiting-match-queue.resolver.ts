import { GraphQLError } from 'graphql';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import {
  BY_SCORE_EVALUATION_CAP,
  chargeRequiresMatch,
  matchesQueueMode,
} from '../helpers/awaiting-match-queue.helper.js';
import { QueueMatchEvaluatorProvider } from '../providers/queue-match-evaluator.provider.js';
import type { ChargesMatcherModule } from '../types.js';

export const chargesAwaitingMatchQueueResolver: ChargesMatcherModule.Resolvers = {
  Query: {
    chargesAwaitingMatchQueue: async (
      _,
      { limit, offset, businessId, fromDate, toDate, mode, sortBy },
      { injector },
    ) => {
      try {
        // Tenant scoping: only ever fetch charges of the verified admin owner,
        // so a requested businessId can't leak other tenants' data
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

        // Most recent first (default sort of getChargesByFilters)
        const charges = await injector.get(ChargesProvider).getChargesByFilters({
          ownerIds: [ownerId],
          businessIds: businessId ? [businessId] : undefined,
          fromDate,
          toDate,
        });

        const queue = charges.filter(
          charge => chargeRequiresMatch(charge) && matchesQueueMode(charge, mode),
        );

        const safeLimit = Math.max(0, limit ?? 20);
        const safeOffset = Math.max(0, offset ?? 0);
        const evaluator = injector.get(QueueMatchEvaluatorProvider);

        if (sortBy === 'BY_SCORE') {
          // Evaluate the capped window of most recent charges, sort the whole
          // derived list by top confidence score, and paginate that list. Scores
          // are required to sort, so they are computed here and carried on each
          // item (the suggestions field resolver returns them directly).
          const window = queue.slice(0, BY_SCORE_EVALUATION_CAP);
          const evaluated = await evaluator.evaluateMatchesForCharges(window);
          const topScore = (suggestions: { confidenceScore: number }[]): number =>
            suggestions[0]?.confidenceScore ?? 0;
          const sorted = evaluated.toSorted(
            (a, b) => topScore(b.suggestions) - topScore(a.suggestions),
          );
          return {
            baseCharges: sorted.slice(safeOffset, safeOffset + safeLimit),
            totalCount: window.length,
          };
        }

        // BY_DATE (default): paginate first and return the base charges without
        // scoring them. Suggestions are resolved lazily by the
        // ChargeWithSuggestions.suggestions field resolver, so the client can
        // @defer them and paint the queue immediately.
        const page = queue.slice(safeOffset, safeOffset + safeLimit);
        return {
          baseCharges: page.map(baseCharge => ({ id: baseCharge.id, baseCharge })),
          totalCount: queue.length,
        };
      } catch (e) {
        if (e instanceof GraphQLError) {
          throw e;
        }
        const message = (e as Error)?.message ?? 'Unknown error';
        throw new GraphQLError(`Failed to fetch charges awaiting match: ${message}`);
      }
    },
  },
};
