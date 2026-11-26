import { createModule } from 'graphql-modules';
import { ShareholdersProvider } from './providers/shareholders.provider.js';
import { shareholdersResolvers } from './resolvers/shareholders.resolver.js';
import shareholders from './typeDefs/shareholders.graphql.js';

const __dirname = import.meta.dirname;

export const report1214Module = createModule({
  id: 'report-1214',
  dirname: __dirname,
  typeDefs: [shareholders],
  resolvers: [shareholdersResolvers],
  providers: () => [ShareholdersProvider],
});

export * as Report1214Types from './types.js';
