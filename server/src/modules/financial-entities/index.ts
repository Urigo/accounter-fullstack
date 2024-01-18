import businessesTransactions from './typeDefs/businesses-transactions.graphql.js';
import businesses from './typeDefs/businesses.graphql.js';
import counterparties from './typeDefs/counterparties.graphql.js';
import financialEntities from './typeDefs/financial-entities.graphql.js';
import taxCategories from './typeDefs/tax-categories.graphql.js';
import { createModule } from 'graphql-modules';
import { BusinessesProvider } from './providers/businesses.provider.js';
import { FinancialEntitiesProvider } from './providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from './providers/tax-categories.provider.js';
import { businessTransactionsResolvers } from './resolvers/business-transactions.resolver.js';
import { businessesResolvers } from './resolvers/businesses.resolver.js';
import { financialEntitiesResolvers } from './resolvers/financial-entities.resolver.js';
import { taxCategoriesResolvers } from './resolvers/tax-categories.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const financialEntitiesModule = createModule({
  id: 'financialEntities',
  dirname: __dirname,
  typeDefs: [businesses, businessesTransactions, counterparties, financialEntities, taxCategories],
  resolvers: [
    financialEntitiesResolvers,
    businessTransactionsResolvers,
    taxCategoriesResolvers,
    businessesResolvers,
  ],
  providers: () => [BusinessesProvider, TaxCategoriesProvider, FinancialEntitiesProvider],
});

export * as FinancialEntitiesTypes from './types.js';
