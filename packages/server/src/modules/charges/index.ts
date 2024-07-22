import chargeSuggestions from './typeDefs/charge-suggestions.graphql.js';
import chargeValidation from './typeDefs/charge-validation.graphql.js';
import charges from './typeDefs/charges.graphql.js';
import { createModule } from 'graphql-modules';
import { ChargeSpreadProvider } from './providers/charge-spread.provider.js';
import { ChargesProvider } from './providers/charges.provider.js';
import { chargeSuggestionsResolvers } from './resolvers/charge-suggestions/charge-suggestions.resolver.js';
import { chargesResolvers } from './resolvers/charges.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const chargesModule = createModule({
  id: 'charges',
  dirname: __dirname,
  typeDefs: [charges, chargeValidation, chargeSuggestions],
  resolvers: [chargesResolvers, chargeSuggestionsResolvers],
  providers: () => [ChargesProvider, ChargeSpreadProvider],
});

export * as ChargesTypes from './types.js';
