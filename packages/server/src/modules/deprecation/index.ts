import deprecation from './typeDefs/deprecation.graphql.js';
import { createModule } from 'graphql-modules';
import { DeprecationCategoriesProvider } from './providers/deprecation-categories.provider.js';
import { DeprecationProvider } from './providers/deprecation.provider.js';
import { deprecationResolvers } from './resolvers/deprecation.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const deprecationModule = createModule({
  id: 'deprecation',
  dirname: __dirname,
  typeDefs: [deprecation],
  resolvers: [deprecationResolvers],
  providers: () => [DeprecationProvider, DeprecationCategoriesProvider],
});

export * as DeprecationTypes from './types.js';
