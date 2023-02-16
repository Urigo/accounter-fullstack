import { createServer } from 'node:http';
import { config } from 'dotenv';
import { createYoga } from 'graphql-yoga';
import 'reflect-metadata';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { GreenInvoiceProvider } from '@modules/app-providers/green-invoice.js';
import { createGraphQLApp } from './modules-app.js';
import { CloudinaryProvider } from './modules/app-providers/cloudinary.js';

config({ path: '../.env' });

async function main() {
  const application = await createGraphQLApp();

  // initiate providers
  application.injector.get(CloudinaryProvider).initCloudinary();
  application.injector.get(GreenInvoiceProvider).init();

  const yoga = createYoga({ plugins: [useGraphQLModules(application)] });

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
