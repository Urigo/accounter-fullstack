import deel from './typeDefs/deel.graphql.js';
import { createModule } from 'graphql-modules';
import { DeelInvoicesProvider } from './providers/deel-invoices.provider.js';
import { DeelWorkersProvider } from './providers/deel-workers.provider.js';
import { DeelProvider } from './providers/deel.provider.js';
import { deelResolvers } from './resolvers/deel.resolvers.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const deelModule = createModule({
  id: 'deel',
  dirname: __dirname,
  typeDefs: [deel],
  resolvers: [deelResolvers],
  providers: () => [DeelProvider, DeelInvoicesProvider, DeelWorkersProvider],
});

export * as DeelTypes from './types.js';
