import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import path, { join } from 'path';
import { fileURLToPath } from 'url';

import { commonSchema } from './type-defs/common.graphql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const commonModule = createModule({
  id: 'common',
  dirname: __dirname,
  typeDefs: commonSchema,
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
});
