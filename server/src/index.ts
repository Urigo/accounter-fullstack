import { createServer } from 'node:http';
import { config } from 'dotenv';
import { createYoga } from 'graphql-yoga';
import 'reflect-metadata';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { createGraphQLApp } from './modules-app.js';
import { CloudinaryProvider } from './modules/app-providers/cloudinary.js';
import { initGreenInvoice } from './providers/green-invoice.js';

config({ path: '../.env' });

async function main() {
  // initiate providers
  try {
    await Promise.all([initGreenInvoice()]);
  } catch (e) {
    console.error(`Error initiating providers: ${e}`);
  }
  const application = await createGraphQLApp();

  application.injector.get(CloudinaryProvider).initCloudinary();

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
