import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import path, { join } from 'path';
import { fileURLToPath } from 'url';

import {accountantSchema} from './type-defs/accountant.graphql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const accountantModule = createModule({
  id: 'accountant',
  dirname: __dirname,
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
  typeDefs: accountantSchema,
});
