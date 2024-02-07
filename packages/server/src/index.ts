import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import 'reflect-metadata';
import { useBasicAuth } from 'plugins/auth-plugin.js';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { GreenInvoiceProvider } from '@modules/app-providers/green-invoice.js';
import { AccounterContext } from '@shared/types';
import { env } from './environment.js';
import { createGraphQLApp } from './modules-app.js';
import { CloudinaryProvider } from './modules/app-providers/cloudinary.js';

async function main() {
  const application = await createGraphQLApp(env);

  // initiate providers
  application.injector.get(CloudinaryProvider).initCloudinary();
  application.injector.get(GreenInvoiceProvider).init();

  const yoga = createYoga({
    plugins: [useBasicAuth(), useGraphQLModules(application), useDeferStream()],
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
