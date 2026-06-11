import { createModule } from 'graphql-modules';
import { EmailIngestionControlProvider } from './providers/email-ingestion-control.provider.js';
import { emailIngestionResolvers } from './resolvers/email-ingestion.resolver.js';
import emailIngestion from './typeDefs/email-ingestion.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const emailIngestionModule = createModule({
  id: 'email-ingestion',
  dirname: __dirname,
  typeDefs: [emailIngestion],
  resolvers: [emailIngestionResolvers],
  providers: [EmailIngestionControlProvider],
});

export * as CommonTypes from './types.js';
export * from './contracts.js';
export * from './providers/email-ingestion-control.provider.js';
