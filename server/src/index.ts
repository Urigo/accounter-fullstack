import { createServer } from 'node:http';
import { config } from 'dotenv';
import { createYoga } from 'graphql-yoga';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { initCloudinary } from './providers/cloudinary.js';
import { initGreenInvoice } from './providers/green-invoice.js';
import { createGraphQLApp } from './modules-app.js';

config({ path: '../.env' });

async function main() {
  // initiate providers
  try {
    await Promise.all([initCloudinary(), initGreenInvoice()]);
  } catch (e) {
    console.error(`Error initiating providers: ${e}`);
  }
  const application = await createGraphQLApp();

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
