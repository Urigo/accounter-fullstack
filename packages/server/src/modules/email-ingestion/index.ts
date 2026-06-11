import { createModule } from 'graphql-modules';
import { EmailIngestionControlProvider } from './providers/email-ingestion-control.provider.js';
import { EmailIngestionIdempotencyProvider } from './providers/email-ingestion-idempotency.provider.js';
import { emailIngestionControlResolver } from './resolvers/email-ingestion-control.resolver.js';
import { emailIngestionResolvers } from './resolvers/email-ingestion.resolver.js';
import emailIngestion from './typeDefs/email-ingestion.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const emailIngestionModule = createModule({
  id: 'email-ingestion',
  dirname: __dirname,
  typeDefs: [emailIngestion],
  resolvers: [emailIngestionResolvers, emailIngestionControlResolver],
  providers: [EmailIngestionControlProvider, EmailIngestionIdempotencyProvider],
});

export * as CommonTypes from './types.js';
export * from './contracts.js';
