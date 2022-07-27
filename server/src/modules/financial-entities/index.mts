import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import { join } from 'path';

import { FinancialEntitiesProvider } from './providers/financial-entities.provider.mjs';

export const financialEntitiesModule = createModule({
  id: 'financial-entities',
  dirname: __dirname,
  typeDefs: loadFilesSync(join(__dirname, './type-defs/*.graphql'), { useRequire: true }),
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
  providers: [FinancialEntitiesProvider],
});
