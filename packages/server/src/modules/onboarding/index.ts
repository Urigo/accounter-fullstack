import { createModule } from 'graphql-modules';
import { SuperAdminProvider } from '../auth/providers/super-admin.provider.js';
import { EntityEnsureProvider } from '../financial-entities/providers/entity-ensure.provider.js';
import { AdminOnboardingProvider } from './providers/admin-onboarding.provider.js';
import { onboardingResolvers } from './resolvers/onboarding.resolver.js';
import onboarding from './typeDefs/onboarding.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const onboardingModule = createModule({
  id: 'onboarding',
  dirname: __dirname,
  typeDefs: [onboarding],
  resolvers: [onboardingResolvers],
  providers: () => [AdminOnboardingProvider, EntityEnsureProvider, SuperAdminProvider],
});
