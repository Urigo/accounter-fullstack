import depreciation from './typeDefs/depreciation.graphql.js';
import { createModule } from 'graphql-modules';
import { DepreciationCategoriesProvider } from './providers/depreciation-categories.provider.js';
import { DepreciationProvider } from './providers/depreciation.provider.js';
import { depreciationResolvers } from './resolvers/depreciation.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const depreciationModule = createModule({
  id: 'depreciation',
  dirname: __dirname,
  typeDefs: [depreciation],
  resolvers: [depreciationResolvers],
  providers: () => [DepreciationProvider, DepreciationCategoriesProvider],
});

export * as DepreciationTypes from './types.js';
