import { Counterparty } from '@shared/gql-types';
import { similarStringsFinder } from '@shared/helpers';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import type { FinancialEntitiesModule } from '../types.js';

export const businessMatcherResolver: FinancialEntitiesModule.Resolvers = {
  Query: {
    findMatchingBusinesses: async (_, __, { injector }) => {
      const businesses = await injector.get(FinancialEntitiesProvider).getAllFinancialEntities();

      const businessesToMatch = businesses.slice(0, 100).map(business => ({
        phrase: business.name,
        id: business.id,
      }));

      const matches = businessesToMatch.map(business => {
        const scores = similarStringsFinder(
          business.phrase,
          businessesToMatch.filter(b => b.id !== business.id),
          {},
        );
        return {
          business: business.id as unknown as Counterparty,
          bestScore: scores.bestScore.id
            ? {
                score: scores.bestScore.score,
                business: scores.bestScore.id as unknown as Counterparty,
              }
            : undefined,
          scores: scores.scores.map(score => ({
            score: score.score,
            business: score.id as unknown as Counterparty,
          })),
        };
      });
      return { matches };
    },
  },
};
