import { createModule } from 'graphql-modules';
import { ManualAutomationsProvider } from './providers/manual-automations.provider.js';
import { manualAutomationsResolvers } from './resolvers/manual-automations.resolver.js';
import manualAutomations from './typeDefs/manual-automations.graphql.js';

const __dirname = import.meta.dirname;

export const manualAutomationsModule = createModule({
  id: 'manual-automations',
  dirname: __dirname,
  typeDefs: [manualAutomations],
  resolvers: [manualAutomationsResolvers],
  providers: () => [ManualAutomationsProvider],
});

export * as ManualAutomationsTypes from './types.js';
