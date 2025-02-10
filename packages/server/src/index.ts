import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import 'reflect-metadata';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { AccounterContext } from '@shared/types';
import { env } from './environment.js';
import { createGraphQLApp } from './modules-app.js';

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
    plugins: [useGraphQLModules(application)],
    context: (yogaContext): AccounterContext => {
      return {
        ...yogaContext,
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
