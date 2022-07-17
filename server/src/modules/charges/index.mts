import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import { join } from 'path';

import { ChargesProvider } from './providers/charges.provider.mjs';

export const chargesModule = createModule({
  id: 'charges',
  dirname: __dirname,
  typeDefs: loadFilesSync(join(__dirname, './type-defs/*.graphql'), { useRequire: true }),
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
  providers: () => [ChargesProvider],
});
