import miscExpenses from './typeDefs/misc-expenses.graphql.js';
import { createModule } from 'graphql-modules';
import { MiscExpensesProvider } from './providers/misc-expenses.provider.js';
import { miscExpensesLedgerEntriesResolvers } from './resolvers/misc-expenses.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const miscExpensesModule = createModule({
  id: 'miscExpenses',
  dirname: __dirname,
  typeDefs: [miscExpenses],
  resolvers: [miscExpensesLedgerEntriesResolvers],
  providers: () => [MiscExpensesProvider],
});

export * as MiscExpensesTypes from './types.js';
