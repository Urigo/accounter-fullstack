import { createModule } from 'graphql-modules';
import { emailIngestionResolvers } from './resolvers/email-ingestion.resolver.js';
import emailIngestion from './typeDefs/email-ingestion.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const emailIngestionModule = createModule({
  id: 'email-ingestion',
  dirname: __dirname,
  typeDefs: [emailIngestion],
  resolvers: [emailIngestionResolvers],
});

export * as CommonTypes from './types.js';
