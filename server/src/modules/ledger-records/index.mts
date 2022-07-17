import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import { join } from 'path';

import { GenerateLedgerRecordsProvider } from './providers/generate-ledger-records.provider.mjs';
import { LedgerRecordsProvider } from './providers/ledger-records.provider.mjs';

export const ledgerRecordsModule = createModule({
  id: 'ledger-records',
  dirname: __dirname,
  typeDefs: loadFilesSync(join(__dirname, './type-defs/*.graphql'), { useRequire: true }),
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
  providers: () => [LedgerRecordsProvider, GenerateLedgerRecordsProvider],
});
