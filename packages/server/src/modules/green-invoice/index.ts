import { fileURLToPath } from 'node:url';
import { createModule } from 'graphql-modules';
import { greenInvoiceResolvers } from './resolvers/green-invoice.resolvers.js';
import greenInvoice from './typeDefs/green-invoice.graphql.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const greenInvoiceModule = createModule({
  id: 'greenInvoice',
  dirname: __dirname,
  typeDefs: [greenInvoice],
  resolvers: [greenInvoiceResolvers],
});

export * as GreenInvoiceTypes from './types.js';
