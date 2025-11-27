import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import postgres from 'pg';
import 'reflect-metadata';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { useHive } from '@graphql-hive/yoga';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { AccounterContext } from '@shared/types';
import { env } from './environment.js';
import { createGraphQLApp } from './modules-app.js';
import { adminContextPlugin } from './plugins/admin-context-plugin.js';
import { authPlugin } from './plugins/auth-plugin.js';

const { Pool } = postgres;

async function main() {
  // Create a shared connection pool for the entire application
  const pool = new Pool({
    user: env.postgres.user,
    password: env.postgres.password,
    host: env.postgres.host,
    port: Number(env.postgres.port),
    database: env.postgres.db,
    ssl: env.postgres.ssl ? { rejectUnauthorized: false } : false,
  });

  pool.on('error', err => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  const application = await createGraphQLApp(env, pool);

  const yoga = createYoga({
    plugins: [
      authPlugin(),
      adminContextPlugin(),
      useGraphQLModules(application),
      useDeferStream(),
      useHive({
        enabled: !!env.hive,
        token: env.hive?.hiveToken ?? '',
        usage: !!env.hive,
      }),
    ],
    context: (yogaContext): AccounterContext => {
      return {
        ...yogaContext,
        env,
        pool,
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
