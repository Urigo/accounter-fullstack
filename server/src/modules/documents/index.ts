import { documentsResolvers } from './resolvers/documents.resolver.js';
import documents from './typeDefs/documents.graphql.js';
import { createModule } from 'graphql-modules';

const __dirname = new URL('.', import.meta.url).pathname;

export const documentsModule = createModule({
  id: 'documents',
  dirname: __dirname,
  typeDefs: [documents],
  resolvers: [documentsResolvers],
  providers: () => [],
});
