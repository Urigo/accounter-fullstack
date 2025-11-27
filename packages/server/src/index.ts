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

  // Graceful shutdown handler
  let isShuttingDown = false;
  const gracefulShutdown = async (
    reason: string,
    err?: unknown,
    exitCode: number = 1,
  ): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    if (err) {
      process.stderr.write(`[shutdown] Reason: ${reason} ${String(err)}\n`);
    } else {
      process.stderr.write(`[shutdown] Reason: ${reason}\n`);
    }

    // Stop accepting new connections
    await new Promise<void>(resolve => {
      server.close(() => resolve());
    });

    // Allow in-flight requests some time to complete, then close the pool
    const FORCE_EXIT_TIMEOUT_MS = 10_000;
    const forceExitTimer = setTimeout(() => {
      process.stderr.write('[shutdown] Force exiting after timeout\n');
      process.exit(exitCode);
    }, FORCE_EXIT_TIMEOUT_MS);
    // Do not keep the event loop alive just for the timer
    (forceExitTimer as unknown as { unref?: () => void }).unref?.();

    try {
      await pool.end();
    } catch (e) {
      process.stderr.write(`[shutdown] Error while closing DB pool ${String(e)}\n`);
    } finally {
      clearTimeout(forceExitTimer);
      process.exit(exitCode);
    }
  };

  // Pool errors: trigger graceful shutdown instead of hard exit
  pool.on('error', err => gracefulShutdown('pg pool error', err, 1));

  // OS signals
  process.on('SIGINT', () => void gracefulShutdown('SIGINT', undefined, 0));
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM', undefined, 0));

  // Unhandled errors
  process.on('unhandledRejection', reason => gracefulShutdown('unhandledRejection', reason, 1));
  process.on('uncaughtException', err => gracefulShutdown('uncaughtException', err, 1));

  server.listen(
    {
      port: 4000,
    },
    () => {
      process.stdout.write('GraphQL API located at http://localhost:4000/graphql\n');
    },
  );
}

main();
