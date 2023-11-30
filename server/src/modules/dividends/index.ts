import dividends from './typeDefs/dividends.graphql.js';
import { createModule } from 'graphql-modules';
import { DividendsProvider } from './providers/dividends.provider.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const dividendsModule = createModule({
  id: 'dividends',
  dirname: __dirname,
  typeDefs: [dividends],
  resolvers: [],
  providers: () => [DividendsProvider],
});

export * as DocumentsTypes from './types.js';
