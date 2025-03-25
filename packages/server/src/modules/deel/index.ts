import deel from './typeDefs/deel.graphql.js';
import { createModule } from 'graphql-modules';
import { DeelContractsProvider } from './providers/deel-contracts.provider.js';
import { DeelInvoicesProvider } from './providers/deel-invoices.provider.js';
import { deelResolvers } from './resolvers/deel.resolvers.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const deelModule = createModule({
  id: 'deel',
  dirname: __dirname,
  typeDefs: [deel],
  resolvers: [deelResolvers],
  providers: () => [DeelInvoicesProvider, DeelContractsProvider],
});

export * as DeelTypes from './types.js';
