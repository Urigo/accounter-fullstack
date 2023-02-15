import financialAccounts from './typeDefs/financial-accounts.graphql.js';
import { createModule } from 'graphql-modules';
import { FinancialAccountsProvider } from './providers/financial-accounts.provider.js';
import { financialAccountsResolvers } from './resolvers/financial-accounts.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const financialAccountsModule = createModule({
  id: 'financialAccounts',
  dirname: __dirname,
  typeDefs: [financialAccounts],
  resolvers: [financialAccountsResolvers],
  providers: () => [FinancialAccountsProvider],
});

export * as FinancialAccountsTypes from './types.js';
