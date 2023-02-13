import { createServer } from 'node:http';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { config } from 'dotenv';
import { createYoga } from 'graphql-yoga';
import { initCloudinary } from './providers/cloudinary.mjs';
import { initGreenInvoice } from './providers/green-invoice.mjs';
import { getSchema } from './schema.mjs';

config({ path: '../.env' });

async function main() {
  // initiate providers
  try {
    await Promise.all([initCloudinary(), initGreenInvoice()]);
  } catch (e) {
    console.error(`Error initiating providers: ${e}`);
  }
  const application = await getSchema();

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
