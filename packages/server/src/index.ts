import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import 'reflect-metadata';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { useHive } from '@graphql-hive/yoga';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { AccounterContext } from '@shared/types';
import { env } from './environment.js';
import { createGraphQLApp } from './modules-app.js';
import { authPlugin } from './plugins/auth-plugin.js';

async function main() {
  const application = await createGraphQLApp(env);

  // While createGraphQLApp initializes the application, we use buildSubgraphSchema to build the Subgraph Schema.
  const yoga = createYoga({
    schema: application.schema,
    graphqlEndpoint: '/legacy',
    graphiql: {
      title: 'Legacy Subgraph',
    },
    landingPage: true,
    plugins: [
      authPlugin(),
      useDeferStream(),
      useGraphQLModules(application),
      useHive({
        enabled: !!env.hive.hiveRegistryToken,
        token: env.hive.hiveRegistryToken ?? '',
        usage: true,
      }),
    ],
    context: (yogaContext): AccounterContext => {
      return {
        ...yogaContext,
        env,
      };
    },
  });

  const server = createServer(yoga);
  const port = 4001;

  server.listen({ port }, () => {
    console.info(`🚀 Legacy Subgraph ready at http://localhost:${port}`);
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
