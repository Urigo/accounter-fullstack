import adminBusinesses from './typeDefs/admin-businesses.graphql.js';
import businessesTransactions from './typeDefs/businesses-transactions.graphql.js';
import businesses from './typeDefs/businesses.graphql.js';
import clients from './typeDefs/clients.graphql.js';
import financialEntities from './typeDefs/financial-entities.graphql.js';
import taxCategories from './typeDefs/tax-categories.graphql.js';
import { createModule } from 'graphql-modules';
import { AdminBusinessesProvider } from './providers/admin-businesses.provider.js';
import { BusinessesProvider } from './providers/businesses.provider.js';
import { ClientsProvider } from './providers/clients.provider.js';
import { FinancialEntitiesProvider } from './providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from './providers/tax-categories.provider.js';
import { adminBusinessesResolvers } from './resolvers/admin-businesses.resolver.js';
import { businessTransactionsResolvers } from './resolvers/business-transactions.resolver.js';
import { businessesResolvers } from './resolvers/businesses.resolver.js';
import { clientsResolvers } from './resolvers/clients.resolvers.js';
import { financialEntitiesResolvers } from './resolvers/financial-entities.resolver.js';
import { taxCategoriesResolvers } from './resolvers/tax-categories.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const financialEntitiesModule = createModule({
  id: 'financialEntities',
  dirname: __dirname,
  typeDefs: [
    businesses,
    businessesTransactions,
    financialEntities,
    taxCategories,
    adminBusinesses,
    clients,
  ],
  resolvers: [
    financialEntitiesResolvers,
    businessTransactionsResolvers,
    taxCategoriesResolvers,
    businessesResolvers,
    adminBusinessesResolvers,
    clientsResolvers,
  ],
  providers: () => [
    BusinessesProvider,
    TaxCategoriesProvider,
    FinancialEntitiesProvider,
    AdminBusinessesProvider,
    ClientsProvider,
  ],
});

export * as FinancialEntitiesTypes from './types.js';
