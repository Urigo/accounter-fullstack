import { createServer } from 'node:http';
import { createYoga, useReadinessCheck } from 'graphql-yoga';
import pg from 'pg';
import { shutdownTelemetry, startTelemetry } from './telemetry/index.js';
import 'reflect-metadata';
import { useSchema } from '@envelop/core';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { useHive } from '@graphql-hive/yoga';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { env } from './environment.js';
import { cleanupExpiredInvitations, type Logger } from './jobs/cleanup-expired-invitations.js';
import { scheduleDailyAtUtc } from './jobs/utils.js';
import { createGraphQLApp } from './modules-app.js';
import { DBProvider } from './modules/app-providers/db.provider.js';
import { startTenantDbClientWatchdog } from './modules/app-providers/tenant-db-client.js';
import { Auth0ManagementProvider } from './modules/auth/providers/auth0-management.provider.js';
import { startPoolMonitor } from './observability/pool-monitor.js';
import { authPlugin } from './plugins/auth-plugin.js';
import { correlationIdPlugin } from './plugins/correlation-id-plugin.js';
import { dbCleanupPlugin } from './plugins/db-cleanup-plugin.js';
import { AccounterContext } from './shared/types/index.js';

const { Pool } = pg;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CLEANUP_SCHEDULE_HOUR_UTC = 2;
const CLEANUP_SCHEDULE_MINUTE_UTC = 0;

async function main() {
  await startTelemetry();

  // Create a shared connection pool for the entire application
  const pool = new Pool({
    user: env.postgres.user,
    password: env.postgres.password,
    host: env.postgres.host,
    port: Number(env.postgres.port),
    database: env.postgres.db,
    ssl: env.postgres.ssl ? { rejectUnauthorized: false } : false,
    max: env.postgres.max, // maximum number of clients in the pool
    // Names this app's connections in pg_stat_activity, so a session can be
    // attributed without guessing from client_addr.
    application_name: 'accounter-server',
    // Never queue for a connection indefinitely: without this, an exhausted
    // pool makes every request hang silently and forever.
    connectionTimeoutMillis: env.postgres.connectionTimeoutMs,
    statement_timeout: env.postgres.statementTimeoutMs,
    // Server-side backstop: Postgres reclaims a session abandoned mid-transaction.
    idle_in_transaction_session_timeout: env.postgres.idleInTransactionTimeoutMs,
    // Detect connections silently dropped by an intermediary rather than
    // discovering it on the next query.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });

  if (env.auth0) {
    console.log(`Auth0 configured: ${env.auth0.domain}`);
  } else {
    console.log('Auth0 not configured');
  }

  const dbProvider = new DBProvider(pool);

  // Reclaim any request-scoped connection whose owner disappeared without
  // disposing it. Disposal is driven by request lifecycle hooks, and the bug
  // class this guards against is precisely a hook that never fires — so this
  // sweep deliberately trusts none of them.
  const dbClientWatchdog = startTenantDbClientWatchdog({
    maxIdleMs: env.postgres.clientMaxIdleMs,
    intervalMs: env.postgres.watchdogIntervalMs,
    onLeak: ({ idleMs, lastQuery }) => {
      process.stderr.write(
        `[db] Reclaiming leaked connection after ${Math.round(idleMs / 1000)}s idle. Last query: ${lastQuery ?? 'unknown'}\n`,
      );
    },
  });

  const poolMonitor =
    env.postgres.monitorIntervalMs > 0
      ? startPoolMonitor({
          pool,
          intervalMs: env.postgres.monitorIntervalMs,
          max: env.postgres.max,
        })
      : null;
  const auth0Provider = new Auth0ManagementProvider(env);
  const logger: Logger = {
    info: (message, meta) => {
      if (meta !== undefined) {
        console.log(message, meta);
        return;
      }
      console.log(message);
    },
    error: (message, meta) => {
      if (meta !== undefined) {
        console.error(message, meta);
        return;
      }
      console.error(message);
    },
  };

  const cleanupSchedule = env.auth0
    ? scheduleDailyAtUtc(
        CLEANUP_SCHEDULE_HOUR_UTC,
        CLEANUP_SCHEDULE_MINUTE_UTC,
        DAY_IN_MS,
        async () => {
          try {
            const result = await cleanupExpiredInvitations(dbProvider, auth0Provider, logger);
            logger.info('Invitation cleanup complete', result);
          } catch (error) {
            logger.error('Scheduled invitation cleanup run failed', { error });
          }
        },
      )
    : null;

  if (cleanupSchedule) {
    logger.info('Scheduled invitation cleanup job', {
      cron: `${CLEANUP_SCHEDULE_MINUTE_UTC} ${CLEANUP_SCHEDULE_HOUR_UTC} * * *`,
      timezone: 'UTC',
    });
  }

  const { application, transformedSchema } = await createGraphQLApp(env, pool);

  const yoga = createYoga({
    plugins: [
      correlationIdPlugin(),
      dbCleanupPlugin(),
      authPlugin(),
      useGraphQLModules(application),
      useSchema(transformedSchema),
      useDeferStream(),
      useHive({
        enabled: !!env.hive,
        token: env.hive?.hiveToken ?? '',
        usage: !!env.hive,
      }),
      useReadinessCheck({
        check: async () => {
          const isHealthy = await dbProvider.healthCheck();
          if (!isHealthy) {
            throw new Error('Database health check failed');
          }
          return isHealthy;
        },
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

    cleanupSchedule?.cancel();
    dbClientWatchdog.stop();
    poolMonitor?.stop();

    // Allow in-flight requests some time to complete, then close the pool
    const FORCE_EXIT_TIMEOUT_MS = 10_000;
    const forceExitTimer = setTimeout(() => {
      process.stderr.write('[shutdown] Force exiting after timeout\n');
      process.exit(exitCode);
    }, FORCE_EXIT_TIMEOUT_MS);
    // Do not keep the event loop alive just for the timer
    forceExitTimer.unref();

    try {
      await pool.end();
    } catch (e) {
      process.stderr.write(`[shutdown] Error while closing DB pool ${String(e)}\n`);
    }

    try {
      await shutdownTelemetry();
    } catch (e) {
      process.stderr.write(`[shutdown] Error while shutting down telemetry ${String(e)}\n`);
    } finally {
      clearTimeout(forceExitTimer);
      process.exit(exitCode);
    }
  };

  // Pool errors: log but don't shutdown on transient errors
  // The pool will attempt to recover from connection issues automatically
  pool.on('error', err => {
    process.stderr.write(`[pool] Unexpected error on idle client: ${String(err)}\n`);
    // Only shutdown on critical errors that indicate the pool is permanently broken
    // For now, log and let the pool attempt recovery
    // If queries start failing consistently, they'll be caught by application error handlers
  });

  // OS signals
  process.on('SIGINT', () =>
    gracefulShutdown('SIGINT', undefined, 0).catch(e =>
      process.stderr.write(`[shutdown] Fatal error during shutdown: ${String(e)}\n`),
    ),
  );
  process.on('SIGTERM', () =>
    gracefulShutdown('SIGTERM', undefined, 0).catch(e =>
      process.stderr.write(`[shutdown] Fatal error during shutdown: ${String(e)}\n`),
    ),
  );

  // Unhandled errors
  process.on('unhandledRejection', reason =>
    gracefulShutdown('unhandledRejection', reason, 1).catch(e =>
      process.stderr.write(`[shutdown] Fatal error during shutdown: ${String(e)}\n`),
    ),
  );
  process.on('uncaughtException', err =>
    gracefulShutdown('uncaughtException', err, 1).catch(e =>
      process.stderr.write(`[shutdown] Fatal error during shutdown: ${String(e)}\n`),
    ),
  );

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
