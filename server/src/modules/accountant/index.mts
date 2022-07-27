import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import { join } from 'path';

export const accountantModule = createModule({
  id: 'accountant',
  dirname: __dirname,
  typeDefs: loadFilesSync(join(__dirname, './type-defs/*.graphql'), { useRequire: true }),
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
});
