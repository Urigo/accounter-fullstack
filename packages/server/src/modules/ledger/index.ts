import ledger from './typeDefs/ledger.graphql.js';
import { createModule } from 'graphql-modules';
import { BalanceCancellationProvider } from './providers/balance-cancellation.provider.js';
import { LedgerProvider } from './providers/ledger.provider.js';
import { UnbalancedBusinessesProvider } from './providers/unbalanced-businesses.provider.js';
import { ledgerResolvers } from './resolvers/ledger.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const ledgerModule = createModule({
  id: 'ledger',
  dirname: __dirname,
  typeDefs: [ledger],
  resolvers: [ledgerResolvers],
  providers: () => [LedgerProvider, UnbalancedBusinessesProvider, BalanceCancellationProvider],
});

export * as LedgerTypes from './types.js';
