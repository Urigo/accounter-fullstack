import { createModule } from 'graphql-modules';
import { DividendsProvider } from './providers/dividends.provider.js';
import dividends from './typeDefs/dividends.graphql.js';

const __dirname = import.meta.dirname;

export const dividendsModule = createModule({
  id: 'dividends',
  dirname: __dirname,
  typeDefs: [dividends],
  resolvers: [],
  providers: () => [DividendsProvider],
});

export * as DocumentsTypes from './types.js';
