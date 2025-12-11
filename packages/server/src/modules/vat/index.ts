import { createModule } from 'graphql-modules';
import { VatProvider } from './providers/vat.provider.js';
import vat from './typeDefs/vat.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const vatModule = createModule({
  id: 'vat',
  dirname: __dirname,
  typeDefs: [vat],
  providers: () => [VatProvider],
});

export * as VatTypes from './types.js';
