import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import { join } from 'path';

import { FinancialAccountsProvider } from './providers/financial-accounts.providers.mjs';

export const financialAccountsModule = createModule({
  id: 'financial-accounts',
  dirname: __dirname,
  typeDefs: loadFilesSync(join(__dirname, './type-defs/*.graphql'), { useRequire: true }),
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
  providers: () => [FinancialAccountsProvider],
});
