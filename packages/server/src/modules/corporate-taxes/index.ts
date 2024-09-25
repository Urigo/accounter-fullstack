import corporateTaxes from './typeDefs/corporate-taxes.graphql.js';
import { createModule } from 'graphql-modules';
import { CorporateTaxesProvider } from './providers/corporate-taxes.provider.js';
import { corporateTaxesResolvers } from './resolvers/corporate-taxes.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const corporateTaxesModule = createModule({
  id: 'corporateTaxes',
  dirname: __dirname,
  typeDefs: [corporateTaxes],
  resolvers: [corporateTaxesResolvers],
  providers: () => [CorporateTaxesProvider],
});

export * as corporateTaxesTypes from './types.js';
