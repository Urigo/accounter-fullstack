import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import path, { join } from 'path';
import { fileURLToPath } from 'url';

import { taxesSchema } from './type-defs/taxes.graphql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const TaxesModule = createModule({
  id: 'taxes',
  dirname: __dirname,
  typeDefs: taxesSchema,
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
});
