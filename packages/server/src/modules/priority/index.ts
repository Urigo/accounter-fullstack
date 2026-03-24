import { createModule } from 'graphql-modules';
import { PriorityCSVImportProvider } from './providers/priority-csv-import.provider.js';
import { PriorityInvoicesProvider } from './providers/priority-invoices.provider.js';
import { priorityResolvers } from './resolvers/priority.resolvers.js';
import priority from './typeDefs/priority.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const priorityModule = createModule({
  id: 'priority',
  dirname: __dirname,
  typeDefs: [priority],
  resolvers: [priorityResolvers],
  providers: () => [PriorityInvoicesProvider, PriorityCSVImportProvider],
});
