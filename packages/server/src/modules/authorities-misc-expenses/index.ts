import authoritiesMiscExpenses from './typeDefs/authorities-misc-expenses.graphql.js';
import { createModule } from 'graphql-modules';
import { AuthoritiesMiscExpensesProvider } from './providers/authorities-misc-expenses.provider.js';
import { authoritiesMiscExpensesLedgerEntriesResolvers } from './resolvers/authorities-misc-expenses.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const authoritiesMiscExpensesModule = createModule({
  id: 'authoritiesMiscExpenses',
  dirname: __dirname,
  typeDefs: [authoritiesMiscExpenses],
  resolvers: [authoritiesMiscExpensesLedgerEntriesResolvers],
  providers: () => [AuthoritiesMiscExpensesProvider],
});

export * as AuthoritiesMiscExpensesTypes from './types.js';
