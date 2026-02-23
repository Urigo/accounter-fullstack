import { createModule, gql } from 'graphql-modules';
import { Auth0ManagementService } from './services/auth0-management.service.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const authModule = createModule({
  id: 'auth',
  dirname: __dirname,
  providers: [Auth0ManagementService],
  typeDefs: gql`
    type Auth0Dummy
  `,
});

export * from './services/auth0-management.service.js';
