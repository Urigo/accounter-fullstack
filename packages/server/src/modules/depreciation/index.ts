import { createModule } from 'graphql-modules';
import { DepreciationCategoriesProvider } from './providers/depreciation-categories.provider.js';
import { DepreciationDisposalsProvider } from './providers/depreciation-disposals.provider.js';
import { DepreciationProvider } from './providers/depreciation.provider.js';
import { depreciationDisposalsResolvers } from './resolvers/depreciation-disposals.resolver.js';
import { depreciationResolvers } from './resolvers/depreciation.resolver.js';
import depreciationDisposals from './typeDefs/depreciation-disposals.graphql.js';
import depreciation from './typeDefs/depreciation.graphql.js';

const __dirname = import.meta.dirname;

export const depreciationModule = createModule({
  id: 'depreciation',
  dirname: __dirname,
  typeDefs: [depreciation, depreciationDisposals],
  resolvers: [depreciationResolvers, depreciationDisposalsResolvers],
  providers: () => [
    DepreciationProvider,
    DepreciationCategoriesProvider,
    DepreciationDisposalsProvider,
  ],
});

export * as DepreciationTypes from './types.js';
