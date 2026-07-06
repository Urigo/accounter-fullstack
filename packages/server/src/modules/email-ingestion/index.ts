import { createModule } from 'graphql-modules';
import { EmailIngestionAliasProvider } from './providers/email-ingestion-alias.provider.js';
import { EmailIngestionControlProvider } from './providers/email-ingestion-control.provider.js';
import { EmailIngestionIngestProvider } from './providers/email-ingestion-ingest.provider.js';
import { emailIngestionAliasResolver } from './resolvers/email-ingestion-alias.resolver.js';
import { emailIngestionControlResolver } from './resolvers/email-ingestion-control.resolver.js';
import { emailIngestionIngestResolver } from './resolvers/email-ingestion-ingest.resolver.js';
import { emailIngestionResolvers } from './resolvers/email-ingestion.resolver.js';
import emailIngestion from './typeDefs/email-ingestion.graphql.js';

const __dirname = import.meta.dirname;

export const emailIngestionModule = createModule({
  id: 'email-ingestion',
  dirname: __dirname,
  typeDefs: [emailIngestion],
  resolvers: [
    emailIngestionResolvers,
    emailIngestionControlResolver,
    emailIngestionIngestResolver,
    emailIngestionAliasResolver,
  ],
  providers: [
    EmailIngestionAliasProvider,
    EmailIngestionControlProvider,
    EmailIngestionIngestProvider,
  ],
});

export * as CommonTypes from './types.js';
export * from './contracts.js';
