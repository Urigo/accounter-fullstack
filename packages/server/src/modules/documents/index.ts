import documentSuggestions from './typeDefs/document-suggestions.graphql.js';
import documents from './typeDefs/documents.graphql.js';
import { createModule } from 'graphql-modules';
import { DocumentsProvider } from './providers/documents.provider.js';
import { documentSuggestionsResolvers } from './resolvers/document-suggestions.resolver.js';
import { documentsResolvers } from './resolvers/documents.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const documentsModule = createModule({
  id: 'documents',
  dirname: __dirname,
  typeDefs: [documents, documentSuggestions],
  resolvers: [documentsResolvers, documentSuggestionsResolvers],
  providers: () => [DocumentsProvider],
});

export * as DocumentsTypes from './types.js';
