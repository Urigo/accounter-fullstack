import { Counterparty } from '@shared/gql-types';
import { similarStringsFinder } from '@shared/helpers';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import type { FinancialEntitiesModule } from '../types.js';

export const businessMatcherResolver: FinancialEntitiesModule.Resolvers = {
  Query: {
    findMatchingBusinesses: async (_, { minScore }, { injector }) => {
      minScore ||= 0;
      const businesses = await injector.get(FinancialEntitiesProvider).getAllFinancialEntities();

      const businessesToMatch = businesses.map(business => ({
        phrase: business.name,
        id: business.id,
      }));

      const matches = businessesToMatch
        .map(business => {
          const scores = similarStringsFinder(
            business.phrase,
            businessesToMatch.filter(b => b.id !== business.id),
            {},
          );
          return {
            business: business.id as unknown as Counterparty,
            bestMatch: scores.bestScore.id
              ? {
                  score: scores.bestScore.score,
                  business: scores.bestScore.id as unknown as Counterparty,
                }
              : undefined,
            moreMatches: scores.scores
              .filter(s => (s.score ?? 0) > minScore! && s.id !== scores.bestScore.id)
              .map(score => ({
                score: score.score,
                business: score.id as unknown as Counterparty,
              })),
          };
        })
        .filter(m => m.bestMatch && (m.bestMatch.score ?? 0) > minScore!);
      return matches;
    },
  },
};
