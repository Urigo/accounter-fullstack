import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import 'reflect-metadata';
import { authPlugin } from 'plugins/auth-plugin.js';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { AccounterContext } from '@shared/types';
import { env } from './environment.js';
import { createGraphQLApp } from './modules-app.js';

async function main() {
  const application = await createGraphQLApp(env);

  const yoga = createYoga({
    plugins: [authPlugin(), useGraphQLModules(application), useDeferStream()],
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
