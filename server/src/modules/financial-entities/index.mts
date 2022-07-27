import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import path, { join } from 'path';
import { fileURLToPath } from 'url';

import { FinancialEntitiesProvider } from './providers/financial-entities.provider.mjs';
import { financialEntitiesSchema } from './type-defs/financial-entities.graphql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const financialEntitiesModule = createModule({
  id: 'financial-entities',
  dirname: __dirname,
  typeDefs: financialEntitiesSchema,
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
  providers: [FinancialEntitiesProvider],
});
