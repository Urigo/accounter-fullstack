import { chargesResolvers } from './resolvers/charges.resolver.js';
import chargeValidation from './typeDefs/charge-validation.graphql.js';
import charges from './typeDefs/charges.graphql.js';
import transactions from './typeDefs/transactions.graphql.js';
import { createModule } from 'graphql-modules';

const __dirname = new URL('.', import.meta.url).pathname;

export const chargesModule = createModule({
  id: 'charges',
  dirname: __dirname,
  typeDefs: [charges, chargeValidation, transactions],
  resolvers: [chargesResolvers],
  providers: () => [],
});
