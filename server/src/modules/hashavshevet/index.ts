import { hashavshevetResolvers } from './resolvers/hashavshevet.resolver.js';
import hashavshevet from './typeDefs/hashavshevet.graphql.js';
import sortCodes from './typeDefs/sort-codes.graphql.js';
import { createModule } from 'graphql-modules';

const __dirname = new URL('.', import.meta.url).pathname;

export const hashavshevetModule = createModule({
  id: 'hashavshevet',
  dirname: __dirname,
  typeDefs: [hashavshevet, sortCodes],
  resolvers: [hashavshevetResolvers],
  providers: () => [],
});
