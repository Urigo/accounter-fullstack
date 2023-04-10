import transactions from './typeDefs/transactions.graphql.js';
import { createModule } from 'graphql-modules';
import { TransactionsProvider } from './providers/transactions.provider.js';
import { transactionsResolvers } from './resolvers/transactions.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const transactionsModule = createModule({
  id: 'transactions',
  dirname: __dirname,
  typeDefs: [transactions],
  resolvers: [transactionsResolvers],
  providers: () => [TransactionsProvider],
});

export * as transactionsTypes from './types.js';
