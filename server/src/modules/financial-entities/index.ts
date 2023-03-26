import beneficiaries from './typeDefs/beneficiaries.graphql.js';
import businessMatcher from './typeDefs/business-matcher.graphql.js';
import businessesTransactions from './typeDefs/businesses-transactions.graphql.js';
import counterparties from './typeDefs/counterparties.graphql.js';
import financialEntities from './typeDefs/financial-entities.graphql.js';
import { createModule } from 'graphql-modules';
import { BusinessesTransactionsProvider } from './providers/businesses-transactions.provider.js';
import { FinancialEntitiesProvider } from './providers/financial-entities.provider.js';
import { businessMatcherResolver } from './resolvers/business-matcher.resolver.js';
import { businessesResolvers } from './resolvers/business-transactions.resolver.js';
import { financialEntitiesResolvers } from './resolvers/financial-entities.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const financialEntitiesModule = createModule({
  id: 'financialEntities',
  dirname: __dirname,
  typeDefs: [
    beneficiaries,
    businessesTransactions,
    counterparties,
    financialEntities,
    businessMatcher,
  ],
  resolvers: [financialEntitiesResolvers, businessesResolvers, businessMatcherResolver],
  providers: () => [FinancialEntitiesProvider, BusinessesTransactionsProvider],
});

export * as FinancialEntitiesTypes from './types.js';
