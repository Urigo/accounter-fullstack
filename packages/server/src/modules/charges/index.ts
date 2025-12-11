import { createModule } from 'graphql-modules';
import { ChargeSpreadProvider } from './providers/charge-spread.provider.js';
import { ChargesProvider } from './providers/charges.provider.js';
import { chargeSuggestionsResolvers } from './resolvers/charge-suggestions/charge-suggestions.resolver.js';
import { chargesResolvers } from './resolvers/charges.resolver.js';
import { financialChargesResolvers } from './resolvers/financial-charges.resolver.js';
import chargeSuggestions from './typeDefs/charge-suggestions.graphql.js';
import chargeValidation from './typeDefs/charge-validation.graphql.js';
import charges from './typeDefs/charges.graphql.js';
import financialCharges from './typeDefs/financial-charges.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const chargesModule = createModule({
  id: 'charges',
  dirname: __dirname,
  typeDefs: [charges, chargeValidation, chargeSuggestions, financialCharges],
  resolvers: [chargesResolvers, chargeSuggestionsResolvers, financialChargesResolvers],
  providers: () => [ChargesProvider, ChargeSpreadProvider],
});

export * as ChargesTypes from './types.js';
