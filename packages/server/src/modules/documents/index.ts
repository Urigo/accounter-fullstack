import { createModule } from 'graphql-modules';
import { DocumentsProvider } from './providers/documents.provider.js';
import { IssuedDocumentsProvider } from './providers/issued-documents.provider.js';
import { documentSuggestionsResolvers } from './resolvers/document-suggestions.resolver.js';
import { documentsIssuingResolvers } from './resolvers/documents-issuing.resolver.js';
import { documentsResolvers } from './resolvers/documents.resolver.js';
import { issuedDocumentsResolvers } from './resolvers/issued-documents.resolver.js';
import documentSuggestions from './typeDefs/document-suggestions.graphql.js';
import DocumentsIssuing from './typeDefs/documents-issuing.graphql.js';
import documents from './typeDefs/documents.graphql.js';
import issuedDocuments from './typeDefs/issued-documents.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const documentsModule = createModule({
  id: 'documents',
  dirname: __dirname,
  typeDefs: [documents, documentSuggestions, DocumentsIssuing, issuedDocuments],
  resolvers: [
    documentsResolvers,
    documentSuggestionsResolvers,
    documentsIssuingResolvers,
    issuedDocumentsResolvers,
  ],
  providers: () => [DocumentsProvider, IssuedDocumentsProvider],
});

export * as DocumentsTypes from './types.js';
