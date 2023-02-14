import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import { join } from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;

export const ledgerModule = createModule({
  id: 'ledger',
  dirname: __dirname,
  typeDefs: loadFilesSync(join(__dirname, './typeDefs/*.graphql'), { useRequire: true }),
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mts')),
  providers: () => [],
});
