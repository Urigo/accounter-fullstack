import { join } from 'node:path';
import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';

export const commonModule = createModule({
  id: 'common',
  dirname: __dirname,
  typeDefs: loadFilesSync(join(__dirname, './typeDefs/*.graphql'), { useRequire: true }),
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mts')),
  providers: [],
});
