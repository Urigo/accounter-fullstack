import { createServer } from 'node:http';
import { config } from 'dotenv';
import { createYoga } from 'graphql-yoga';
import { initCloudinary } from './providers/cloudinary.mjs';
import { initGreenInvoice } from './providers/green-invoice.mjs';
import { getSchema } from './schema.mjs';

config();

async function main() {
  // initiate providers
  try {
    await Promise.all([initCloudinary(), initGreenInvoice()]);
  } catch (e) {
    console.error(`Error initiating providers: ${e}`);
  }
  const schema = await getSchema();

  const yoga = createYoga({ schema });

  const app = createServer(yoga);

  app.listen(
    {
      port: 4000,
    },
    () => {
      console.log('GraphQL API located at http://localhost:4000/graphql');
    }
  );
}

main();
