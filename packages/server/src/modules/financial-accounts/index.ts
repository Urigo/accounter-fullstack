import financialAccounts from './typeDefs/financial-accounts.graphql.js';
import financialBankAccounts from './typeDefs/financial-bank-accounts.graphql.js';
import { createModule } from 'graphql-modules';
import { FinancialAccountsProvider } from './providers/financial-accounts.provider.js';
import { FinancialBankAccountsProvider } from './providers/financial-bank-accounts.provider.js';
import { financialAccountsResolvers } from './resolvers/financial-accounts.resolver.js';
import { financialBankAccountsResolvers } from './resolvers/financial-bank-accounts.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const financialAccountsModule = createModule({
  id: 'financialAccounts',
  dirname: __dirname,
  typeDefs: [financialAccounts, financialBankAccounts],
  resolvers: [financialAccountsResolvers, financialBankAccountsResolvers],
  providers: () => [FinancialAccountsProvider, FinancialBankAccountsProvider],
});

export * as FinancialAccountsTypes from './types.js';
