import { AdminOnboardingProvider } from '../providers/admin-onboarding.provider.js';
import type { OnboardingModule } from '../types.js';

export const onboardingResolvers: OnboardingModule.Resolvers = {
  Mutation: {
    bootstrapNewClient: async (_parent, { input }, { injector }) => {
      const { business, invitationToken, adminContext } = await injector
        .get(AdminOnboardingProvider)
        .bootstrapNewClient(input);

      return { id: business.id, business, invitationToken, adminContext };
    },
  },
};
