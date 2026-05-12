import { GraphQLError } from 'graphql';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { AdminOnboardingProvider } from '../providers/admin-onboarding.provider.js';
import type { OnboardingModule } from '../types.js';

export const onboardingResolvers: OnboardingModule.Resolvers = {
  Mutation: {
    bootstrapNewClient: async (_parent, { input }, { injector }) => {
      const provider = injector.get(AdminOnboardingProvider);
      const businessesProvider = injector.get(BusinessesProvider);

      const { adminEntityId, invitationToken } = await provider.bootstrapNewClient(input);

      const [business, adminContext] = await Promise.all([
        businessesProvider.getBusinessByIdLoader.load(adminEntityId),
        provider.getBootstrapResult(adminEntityId),
      ]);

      if (!business) {
        throw new GraphQLError('Admin business not found after bootstrap', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return { business, invitationToken, adminContext };
    },
  },
};
