import chargeSuggestions from './typeDefs/charge-suggestions.graphql.js';
import chargeValidation from './typeDefs/charge-validation.graphql.js';
import charges from './typeDefs/charges.graphql.js';
import temp from './typeDefs/temp.graphql.js';
import { createModule } from 'graphql-modules';
import { ChargesProvider } from './providers/charges.provider.js';
import { TempProvider } from './providers/temp.provider.js';
import { chargeSuggestionsResolvers } from './resolvers/charge-suggestions/charge-suggestions.resolver.js';
import { chargesResolvers } from './resolvers/charges.resolver.js';
import { tempResolvers } from './resolvers/temp.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const chargesModule = createModule({
  id: 'charges',
  dirname: __dirname,
  typeDefs: [charges, chargeValidation, chargeSuggestions, temp],
  resolvers: [chargesResolvers, chargeSuggestionsResolvers, tempResolvers],
  providers: () => [ChargesProvider, TempProvider],
});

export * as ChargesTypes from './types.js';
