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

  const yoga = createYoga({
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

  server.listen(
    {
      port: 4000,
    },
    () => {
      console.log('GraphQL API located at http://localhost:4000/graphql');
    },
  );
}

main();
