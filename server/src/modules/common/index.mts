import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import path, { join } from 'path';
import { fileURLToPath } from 'url';

import { businessTripsSchema } from './type-defs/business-trips.graphql.js';
import { commonSchema } from './type-defs/common.graphql.js';
import { errorsSchema } from './type-defs/errors.graphql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const commonModule = createModule({
  id: 'common',
  dirname: __dirname,
  typeDefs: [commonSchema, errorsSchema, businessTripsSchema],
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
});
