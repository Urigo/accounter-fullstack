import { createModule } from 'graphql-modules';
import { CronJobsProvider } from './providers/cron-jobs.provider.js';
import { cronJobsResolvers } from './resolvers/cron-jobs.resolver.js';
import cronJobs from './typeDefs/cron-jobs.graphql.js';

const __dirname = import.meta.dirname;

export const cronJobsModule = createModule({
  id: 'cron-jobs',
  dirname: __dirname,
  typeDefs: [cronJobs],
  resolvers: [cronJobsResolvers],
  providers: () => [CronJobsProvider],
});

export * as CronJobsTypes from './types.js';
