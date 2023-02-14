import { financialAccountsResolvers } from './resolvers/financial-accounts.resolver.js';
import financialAccounts from './typeDefs/financial-accounts.graphql.js';
import { createModule } from 'graphql-modules';

const __dirname = new URL('.', import.meta.url).pathname;

export const financialAccountsModule = createModule({
  id: 'financialAccounts',
  dirname: __dirname,
  typeDefs: [financialAccounts],
  resolvers: [financialAccountsResolvers],
  providers: () => [],
});
