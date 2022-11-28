import { config } from 'dotenv';
import { createYoga } from 'graphql-yoga';
import { createServer } from 'node:http';

import { getSchema } from './schema.mjs';

config();

async function main() {
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
