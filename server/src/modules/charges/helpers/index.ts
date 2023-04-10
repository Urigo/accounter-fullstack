import chargeSuggestions from './typeDefs/charge-suggestions.graphql.js';
import chargeValidation from './typeDefs/charge-validation.graphql.js';
import charges from './typeDefs/charges.graphql.js';
import transactions from './typeDefs/transactions.graphql.js';
import { createModule } from 'graphql-modules';
import { ChargesProvider } from './providers/charges.provider.js';
import { chargeSuggestionsResolvers } from './resolvers/charge-suggestions.resolver.js';
import { chargesResolvers } from './resolvers/charges.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const chargesModule = createModule({
  id: 'charges',
  dirname: __dirname,
  typeDefs: [charges, chargeValidation, transactions, chargeSuggestions],
  resolvers: [chargesResolvers, chargeSuggestionsResolvers],
  providers: () => [ChargesProvider],
});

export * as ChargesTypes from './types.js';
