import cornJobs from './typeDefs/corn-jobs.graphql.js';
import { createModule } from 'graphql-modules';
import { CornJobsProvider } from './providers/corn-jobs.provider.js';
import { cornJobsResolvers } from './resolvers/corn-jobs.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const cornJobsModule = createModule({
  id: 'corn-jobs',
  dirname: __dirname,
  typeDefs: [cornJobs],
  resolvers: [cornJobsResolvers],
  providers: () => [CornJobsProvider],
});

export * as CornJobsTypes from './types.js';
