import { createModule } from 'graphql-modules';
import { ProviderCredentialsProvider } from './providers/provider-credentials.provider.js';
import { providerCredentialsResolvers } from './resolvers/provider-credentials.resolvers.js';
import providerCredentials from './typeDefs/provider-credentials.graphql.js';

const __dirname = import.meta.dirname;

export const providerCredentialsModule = createModule({
  id: 'providerCredentials',
  dirname: __dirname,
  typeDefs: [providerCredentials],
  resolvers: [providerCredentialsResolvers],
  providers: [ProviderCredentialsProvider],
});

export * as ProviderCredentialsTypes from './types.js';
