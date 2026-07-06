import { fileURLToPath } from 'node:url';
import { createModule } from 'graphql-modules';
import { CorporateTaxesProvider } from './providers/corporate-taxes.provider.js';
import { corporateTaxesResolvers } from './resolvers/corporate-taxes.resolver.js';
import corporateTaxes from './typeDefs/corporate-taxes.graphql.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const corporateTaxesModule = createModule({
  id: 'corporateTaxes',
  dirname: __dirname,
  typeDefs: [corporateTaxes],
  resolvers: [corporateTaxesResolvers],
  providers: () => [CorporateTaxesProvider],
});

export * as corporateTaxesTypes from './types.js';
