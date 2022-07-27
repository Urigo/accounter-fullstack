import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import { join } from 'path';

import { DocumentsProvider } from './providers/documents.provider.mjs';

export const documentsModule = createModule({
  id: 'documents',
  dirname: __dirname,
  typeDefs: loadFilesSync(join(__dirname, './type-defs/*.graphql'), { useRequire: true }),
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
  providers: () => [DocumentsProvider],
});
