import { createModule } from 'graphql-modules';
import { greenInvoiceResolvers } from './resolvers/green-invoice.resolvers.js';
import greenInvoice from './typeDefs/green-invoice.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const greenInvoiceModule = createModule({
  id: 'greenInvoice',
  dirname: __dirname,
  typeDefs: [greenInvoice],
  resolvers: [greenInvoiceResolvers],
});

export * as GreenInvoiceTypes from './types.js';
