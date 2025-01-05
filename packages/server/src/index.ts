import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import 'reflect-metadata';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { GraphQLResolverMap } from '@apollo/subgraph/dist/schema-helper/resolverMap.js';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { useHive } from '@graphql-hive/yoga';
import { mergeResolvers, mergeTypeDefs } from '@graphql-tools/merge';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { AccounterContext } from '@shared/types';
import { env } from './environment.js';
import { createGraphQLApp } from './modules-app.js';
import { authPlugin } from './plugins/auth-plugin.js';

async function main() {
  const application = await createGraphQLApp(env);
  const typeDefs = mergeTypeDefs(application.typeDefs);
  const resolvers = mergeResolvers(application.resolvers) as GraphQLResolverMap<unknown>;

  const yoga = createYoga({
    schema: buildSubgraphSchema([
      {
        typeDefs,
        resolvers,
      },
    ]),
    graphqlEndpoint: '/graphql',
    graphiql: {
      title: 'Legacy Subgraph',
    },
    landingPage: true,
    plugins: [
      authPlugin(),
      useGraphQLModules(application),
      useDeferStream(),
      useHive({
        enabled: !!env.hive.hiveToken,
        token: env.hive.hiveToken ?? '',
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

  server.listen(
    {
      port,
    },
    () => {
      console.info(`🚀 Legacy Subgraph ready at http://localhost:${port}`);
    },
  );
}

main();
