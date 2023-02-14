import { businessesResolvers } from './resolvers/business-transactions.resolver.js';
import { financialEntitiesResolvers } from './resolvers/financial-entities.resolver.js';
import beneficiaries from './typeDefs/beneficiaries.graphql.js';
import businessesTransactions from './typeDefs/businesses-transactions.graphql.js';
import counterparties from './typeDefs/counterparties.graphql.js';
import financialEntities from './typeDefs/financial-entities.graphql.js';
import { createModule } from 'graphql-modules';

const __dirname = new URL('.', import.meta.url).pathname;

export const financialEntitiesModule = createModule({
  id: 'financialEntities',
  dirname: __dirname,
  typeDefs: [beneficiaries, businessesTransactions, counterparties, financialEntities],
  resolvers: [financialEntitiesResolvers, businessesResolvers],
  providers: () => [],
});
