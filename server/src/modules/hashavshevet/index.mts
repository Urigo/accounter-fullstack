import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import path, { join } from 'path';
import { fileURLToPath } from 'url';

import { HashavshevetProvider } from './providers/hashavshevet.provider.mjs';
import { hashavshevetSchema } from './type-defs/hashavshevet.graphql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const HashavshevetModule = createModule({
  id: 'hashavshevet',
  dirname: __dirname,
  typeDefs: hashavshevetSchema,
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
  providers: () => [HashavshevetProvider],
});
