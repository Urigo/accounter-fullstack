import documentSuggestions from './typeDefs/document-suggestions.graphql.js';
import documents from './typeDefs/documents.graphql.js';
import issuedDocuments from './typeDefs/issued-documents.graphql.js';
import { createModule } from 'graphql-modules';
import { DocumentsProvider } from './providers/documents.provider.js';
import { IssuedDocumentsProvider } from './providers/issued-documents.provider.js';
import { documentSuggestionsResolvers } from './resolvers/document-suggestions.resolver.js';
import { documentsResolvers } from './resolvers/documents.resolver.js';
import { issuedDocumentsResolvers } from './resolvers/issued-documents.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const documentsModule = createModule({
  id: 'documents',
  dirname: __dirname,
  typeDefs: [documents, documentSuggestions, issuedDocuments],
  resolvers: [documentsResolvers, documentSuggestionsResolvers, issuedDocumentsResolvers],
  providers: () => [DocumentsProvider, IssuedDocumentsProvider],
});

export * as DocumentsTypes from './types.js';
