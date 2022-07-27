import { loadFilesSync } from '@graphql-tools/load-files';
import { createModule } from 'graphql-modules';
import path, { join } from 'path';
import { fileURLToPath } from 'url';

import { GenerateLedgerRecordsProvider } from './providers/generate-ledger-records.provider.mjs';
import { LedgerRecordsProvider } from './providers/ledger-records.provider.mjs';
import { ledgerRecordsSchema } from './type-defs/ledger-records.graphql.js';
import { ledgerRecordsMutationsSchema } from './type-defs/ledger-records-mutations.graphql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ledgerRecordsModule = createModule({
  id: 'ledger-records',
  dirname: __dirname,
  typeDefs: [ledgerRecordsSchema, ledgerRecordsMutationsSchema],
  resolvers: loadFilesSync(join(__dirname, './resolvers/*.mjs')),
  providers: () => [LedgerRecordsProvider, GenerateLedgerRecordsProvider],
});
