import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import path, { join } from 'path';
import { fileURLToPath } from 'url';

import { DocumentsProvider } from './providers/documents.provider.mjs';
import { documentsSchema } from './type-defs/documents.graphql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const documentsModule = createModule({
  id: 'documents',
  dirname: __dirname,
  typeDefs: documentsSchema,
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
  providers: () => [DocumentsProvider],
});
