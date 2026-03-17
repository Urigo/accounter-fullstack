import { createModule } from 'graphql-modules';
import { gmailListenerResolvers } from './resolvers/gmail-listener.resolver.js';
import gmailListener from './typeDefs/gmail-listener.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const gmailListenerModule = createModule({
  id: 'gmail-listener',
  dirname: __dirname,
  typeDefs: [gmailListener],
  resolvers: [gmailListenerResolvers],
});

export * as CommonTypes from './types.js';
