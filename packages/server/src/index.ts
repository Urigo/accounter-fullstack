import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import 'reflect-metadata';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { AUTH_ROLE, AUTH_USER_ID, AUTH_USERNAME } from '@shared/constants';
import { Role } from '@shared/gql-types';
import { AccounterContext, UserType } from '@shared/types';
import { env } from './environment.js';
import { createGraphQLApp } from './modules-app.js';
import { adminContextPlugin } from './plugins/admin-context-plugin.js';

async function main() {
  const application = await createGraphQLApp(env);

  // While createGraphQLApp initializes the application, we use buildSubgraphSchema to build the Subgraph Schema.
  const yoga = createYoga({
    schema: application.schema,
    graphqlEndpoint: '/subgraphs/legacy',
    graphiql: {
      title: 'Legacy Subgraph',
    },
    landingPage: true,
    plugins: [adminContextPlugin(), useGraphQLModules(application)],
    context: (yogaContext): AccounterContext => {
      const headers = yogaContext.request.headers;
      const authRole = headers.get(AUTH_ROLE) as Role;
      const authUsername = headers.get(AUTH_USERNAME);
      const authUserId = headers.get(AUTH_USER_ID);
      if (!authRole || !authUsername || !authUserId) {
        throw new Error('Unauthorized');
      }
      const currentUser: UserType = {
        userId: authUserId,
        role: authRole,
        username: authUsername,
      };

      return {
        ...yogaContext,
        currentUser,
        env,
      };
    },
  });

  const server = createServer(yoga);
  const port = env.hive.hiveSubgraphPort;

  server.listen({ port }, () => {
    console.info(`🚀 Legacy Subgraph ready at http://localhost:${port}`);
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
