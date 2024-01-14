import beneficiaries from './typeDefs/beneficiaries.graphql.js';
import businessesTransactions from './typeDefs/businesses-transactions.graphql.js';
import counterparties from './typeDefs/counterparties.graphql.js';
import financialEntities from './typeDefs/financial-entities.graphql.js';
import taxCategories from './typeDefs/tax-categories.graphql.js';
import { createModule } from 'graphql-modules';
import { FinancialEntitiesProvider } from './providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from './providers/tax-categories.provider.js';
import { businessTransactionsResolvers } from './resolvers/business-transactions.resolver.js';
import { financialEntitiesResolvers } from './resolvers/financial-entities.resolver.js';
import { taxCategoriesResolvers } from './resolvers/tax-categories.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const financialEntitiesModule = createModule({
  id: 'financialEntities',
  dirname: __dirname,
  typeDefs: [
    beneficiaries,
    businessesTransactions,
    counterparties,
    financialEntities,
    taxCategories,
  ],
  resolvers: [financialEntitiesResolvers, businessTransactionsResolvers, taxCategoriesResolvers],
  providers: () => [
    FinancialEntitiesProvider,
    TaxCategoriesProvider,
  ],
});

export * as FinancialEntitiesTypes from './types.js';
