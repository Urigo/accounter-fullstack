import { createModule } from 'graphql-modules';
import { Report1214ProfileProvider } from './providers/report-1214-profile.provider.js';
import { ShareholdersProvider } from './providers/shareholders.provider.js';
import { report1214ProfileResolvers } from './resolvers/report-1214-profile.resolver.js';
import { report1214Resolvers } from './resolvers/report-1214.resolver.js';
import { shareholdersResolvers } from './resolvers/shareholders.resolver.js';
import report1214Profile from './typeDefs/report-1214-profile.graphql.js';
import report1214 from './typeDefs/report-1214.graphql.js';
import shareholders from './typeDefs/shareholders.graphql.js';

const __dirname = import.meta.dirname;

export const report1214Module = createModule({
  id: 'report-1214',
  dirname: __dirname,
  typeDefs: [shareholders, report1214Profile, report1214],
  resolvers: [shareholdersResolvers, report1214ProfileResolvers, report1214Resolvers],
  providers: () => [ShareholdersProvider, Report1214ProfileProvider],
});

export * as Report1214Types from './types.js';
