import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import { join } from 'path';

import { HashavshevetProvider } from './providers/hashavshevet.provider.mjs';

export const HashavshevetModule = createModule({
  id: 'hashavshevet',
  dirname: __dirname,
  typeDefs: loadFilesSync(join(__dirname, './type-defs/*.graphql'), { useRequire: true }),
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
  providers: () => [HashavshevetProvider],
});
