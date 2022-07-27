import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import path, { join } from 'path';
import { fileURLToPath } from 'url';

import { ChargesProvider } from './providers/charges.provider.mjs';
import { chargesSchema } from './type-defs/charges.graphql.js';
import { chargesMutationsSchema } from './type-defs/charges-mutations.graphql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const chargesModule = createModule({
  id: 'charges',
  dirname: __dirname,
  typeDefs: [chargesSchema, chargesMutationsSchema],
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
  providers: () => [ChargesProvider],
});
