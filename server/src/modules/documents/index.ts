import documents from './typeDefs/documents.graphql.js';
import { createModule } from 'graphql-modules';
import { DocumentsProvider } from './providers/documents.provider.js';
import { documentsResolvers } from './resolvers/documents.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const documentsModule = createModule({
  id: 'documents',
  dirname: __dirname,
  typeDefs: [documents],
  resolvers: [documentsResolvers],
  providers: () => [DocumentsProvider],
});

export * as DocumentsTypes from './types.js';
