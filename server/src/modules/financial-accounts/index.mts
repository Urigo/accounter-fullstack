import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import path, { join } from 'path';
import { fileURLToPath } from 'url';

import { FinancialAccountsProvider } from './providers/financial-accounts.providers.mjs';
import { financialAccountsSchema } from './type-defs/financial-accounts.graphql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const financialAccountsModule = createModule({
  id: 'financial-accounts',
  dirname: __dirname,
  typeDefs: financialAccountsSchema,
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
  providers: () => [FinancialAccountsProvider],
});
