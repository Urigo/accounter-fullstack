import greenInvoice from './typeDefs/green-invoice.graphql.js';
import { createModule } from 'graphql-modules';
import { GreenInvoiceProvider } from './providers/green-invoice.provider.js';
import { greenInvoiceResolvers } from './resolvers/green-invoice.resolvers.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const greenInvoiceModule = createModule({
  id: 'greenInvoice',
  dirname: __dirname,
  typeDefs: [greenInvoice],
  resolvers: [greenInvoiceResolvers],
  providers: () => [GreenInvoiceProvider],
});

export * as GreenInvoiceTypes from './types.js';
