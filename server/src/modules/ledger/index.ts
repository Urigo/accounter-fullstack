import ledger from './typeDefs/ledger.graphql.js';
import { createModule } from 'graphql-modules';
import { UnbalancedBusinessesProvider } from './providers/unbalanced-businesses.provider.js';
import { ledgerResolvers } from './resolvers/ledger.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const ledgerModule = createModule({
  id: 'ledger',
  dirname: __dirname,
  typeDefs: [ledger],
  resolvers: [ledgerResolvers],
  providers: () => [UnbalancedBusinessesProvider],
});

export * as LedgerTypes from './types.js';
