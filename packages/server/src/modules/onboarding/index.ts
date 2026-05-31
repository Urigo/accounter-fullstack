import { createModule } from 'graphql-modules';
import { AdminOnboardingProvider } from './providers/admin-onboarding.provider.js';
import { ShaamImportProvider } from './providers/shaam-import.provider.js';
import { onboardingResolvers } from './resolvers/onboarding.resolver.js';
import onboarding from './typeDefs/onboarding.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const onboardingModule = createModule({
  id: 'onboarding',
  dirname: __dirname,
  typeDefs: [onboarding],
  resolvers: [onboardingResolvers],
  providers: () => [AdminOnboardingProvider, ShaamImportProvider],
});
