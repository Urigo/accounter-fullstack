import { createServer } from '@graphql-yoga/node';
import { getSchema } from './schema.mjs';
import { config } from 'dotenv';

config();

async function main() {
  const schema = await getSchema();
  const server = createServer({ schema });
  await server.start();
}

main();
