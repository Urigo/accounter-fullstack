import * as http from 'node:http';
import { createYoga } from 'graphql-yoga';
import 'reflect-metadata';
import httpAuth from 'http-auth';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { AccounterContext } from '@shared/types';
import { env } from './environment.js';
import { createGraphQLApp } from './modules-app.js';
import { authPlugin } from './plugins/auth-plugin.js';

const __dirname = new URL('.', import.meta.url).pathname;

const validateAuth = httpAuth.basic({
  realm: 'Accounter',
  file: __dirname + '.htpasswd',
});

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

  const server = http.createServer(validateAuth.check(yoga));

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
