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
import { CbsPriceIndexClient } from './modules/app-providers/cbs-price-index-client.js';
import { DBProvider } from './modules/app-providers/db.provider.js';
import { startTenantDbClientWatchdog } from './modules/app-providers/tenant-db-client.js';
import { Auth0ManagementProvider } from './modules/auth/providers/auth0-management.provider.js';
import { PriceIndexSyncProvider } from './modules/price-indexes/providers/price-index-sync.provider.js';
import { createYogaLogger, log, serializeError, setLogLevel } from './observability/log.js';
import { startPoolMonitor } from './observability/pool-monitor.js';
import { authPlugin } from './plugins/auth-plugin.js';
import { correlationIdPlugin } from './plugins/correlation-id-plugin.js';
import { dbCleanupPlugin } from './plugins/db-cleanup-plugin.js';
import { pgTypeParsers } from './shared/helpers/pg-type-parsers.js';
import { AccounterContext } from './shared/types/index.js';

const { Pool } = pg;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CLEANUP_SCHEDULE_HOUR_UTC = 2;
const CLEANUP_SCHEDULE_MINUTE_UTC = 0;
// CBS publishes price indexes at 18:30 Israel time (14:00 on Fridays); 17:00 UTC is after both in
// either DST state
const PRICE_INDEX_SYNC_HOUR_UTC = 17;
const PRICE_INDEX_SYNC_MINUTE_UTC = 0;

async function main() {
  // From SERVER_LOG_LEVEL (default `info`), never from `DEBUG`. One level for this server's own
  // structured logs, Yoga and Hive (which forwards its logs to Yoga's logger).
  setLogLevel(env.logging.level);

  await startTelemetry();

  // Create a shared connection pool for the entire application
  const pool = new Pool({
    user: env.postgres.user,
    password: env.postgres.password,
    host: env.postgres.host,
    port: Number(env.postgres.port),
    database: env.postgres.db,
    ssl: env.postgres.ssl && { rejectUnauthorized: false },
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
    // Retire idle connections before the database or an intermediary kills them
    // from the far side — a connection killed while idle stays in the pool and
    // fails the *next* request that checks it out, which is why only the first
    // request after a quiet period failed (#4348).
    idleTimeoutMillis: env.postgres.idleTimeoutMs,
    // Detect connections silently dropped by an intermediary rather than
    // discovering it on the next query.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    // Keep `date` columns as `yyyy-mm-dd` strings instead of server-local `Date`s (#4560).
    types: pgTypeParsers,
  });

  if (env.auth0) {
    log('info', 'auth0-configured', { domain: env.auth0.domain });
  } else {
    log('info', 'auth0-not-configured');
  }

  const dbProvider = new DBProvider(pool);

  // Reclaim any request-scoped connection whose owner disappeared without
  // disposing it. Disposal is driven by request lifecycle hooks, and the bug
  // class this guards against is precisely a hook that never fires — so this
  // sweep deliberately trusts none of them.
  const dbClientWatchdog = startTenantDbClientWatchdog({
    maxIdleMs: env.postgres.clientMaxIdleMs,
    activeMaxIdleMs: env.postgres.activeClientMaxIdleMs,
    abortedMaxIdleMs: env.postgres.abortedClientMaxIdleMs,
    intervalMs: env.postgres.watchdogIntervalMs,
    onLeak: ({
      idleMs,
      lastQuery,
      operationInFlight,
      requestAborted,
      operationName,
      requestId,
    }) => {
      log('error', 'db-leaked-connection-reclaimed', {
        idleMs,
        // `aborted`: the caller hung up and the deferred disposal never completed.
        // `in-flight`: the operation is still marked as executing.
        state: requestAborted ? 'aborted' : operationInFlight ? 'in-flight' : 'idle',
        lastQuery: lastQuery ?? null,
        operationName: operationName ?? null,
        requestId: requestId ?? null,
      });
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
  // A plain-object `meta` becomes the record's fields; anything else (an array of results) goes
  // under `meta`.
  const metaFields = (meta: unknown) =>
    meta === undefined
      ? undefined
      : typeof meta === 'object' && meta !== null && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : { meta };
  const logger: Logger = {
    info: (message, meta) => log('info', message, metaFields(meta)),
    error: (message, meta) => log('error', message, metaFields(meta)),
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

  const priceIndexSync = new PriceIndexSyncProvider(dbProvider, new CbsPriceIndexClient());
  const runPriceIndexSync = async () => {
    try {
      const results = await priceIndexSync.sync();
      logger.info('Price index sync complete', results);
    } catch (error) {
      logger.error('Price index sync failed', { error });
    }
  };
  const priceIndexSchedule = env.priceIndexSync.enabled
    ? scheduleDailyAtUtc(
        PRICE_INDEX_SYNC_HOUR_UTC,
        PRICE_INDEX_SYNC_MINUTE_UTC,
        DAY_IN_MS,
        runPriceIndexSync,
      )
    : null;

  if (priceIndexSchedule) {
    logger.info('Scheduled price index sync job', {
      cron: `${PRICE_INDEX_SYNC_MINUTE_UTC} ${PRICE_INDEX_SYNC_HOUR_UTC} * * *`,
      timezone: 'UTC',
    });
    // Backfills a fresh database and catches up after downtime; no-op when nothing new is due
    void runPriceIndexSync();
  }

  const { application, transformedSchema } = await createGraphQLApp(env, pool);

  const yoga = createYoga({
    // Single-line JSON at the level set above. `useHive` forwards its own logs to this logger, so
    // the one level covers Hive too.
    logging: createYogaLogger(),
    // Yoga's 25 MB default is too small for the email-ingestion gateway, which sends up
    // to 20 MB of attachments (`MAX_EXTRACTED_BYTES`) base64-inlined in JSON, ~27 MB.
    maxRequestBodySize: 50_000_000,
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

    // A crash takes the process down (`fatal`); a signal is an ordinary stop.
    if (err) {
      log('fatal', 'server-shutting-down', { reason, error: serializeError(err) });
    } else {
      log('info', 'server-shutting-down', { reason });
    }

    // Stop accepting new connections
    await new Promise<void>(resolve => {
      server.close(() => resolve());
    });

    cleanupSchedule?.cancel();
    priceIndexSchedule?.cancel();
    dbClientWatchdog.stop();
    poolMonitor?.stop();

    // Allow in-flight requests some time to complete, then close the pool
    const FORCE_EXIT_TIMEOUT_MS = 10_000;
    const forceExitTimer = setTimeout(() => {
      log('fatal', 'server-shutdown-timed-out', { timeoutMs: FORCE_EXIT_TIMEOUT_MS });
      process.exit(exitCode);
    }, FORCE_EXIT_TIMEOUT_MS);
    // Do not keep the event loop alive just for the timer
    forceExitTimer.unref();

    try {
      await pool.end();
    } catch (e) {
      log('error', 'server-shutdown-pool-close-failed', { error: serializeError(e) });
    }

    try {
      await shutdownTelemetry();
    } catch (e) {
      log('error', 'server-shutdown-telemetry-failed', { error: serializeError(e) });
    } finally {
      clearTimeout(forceExitTimer);
      process.exit(exitCode);
    }
  };

  // Pool errors: log but don't shutdown on transient errors
  // The pool will attempt to recover from connection issues automatically
  pool.on('error', err => {
    log('error', 'db-pool-idle-client-error', { error: serializeError(err) });
    // Only shutdown on critical errors that indicate the pool is permanently broken
    // For now, log and let the pool attempt recovery
    // If queries start failing consistently, they'll be caught by application error handlers
  });

  // OS signals
  process.on('SIGINT', () =>
    gracefulShutdown('SIGINT', undefined, 0).catch(e =>
      log('fatal', 'server-shutdown-failed', { error: serializeError(e) }),
    ),
  );
  process.on('SIGTERM', () =>
    gracefulShutdown('SIGTERM', undefined, 0).catch(e =>
      log('fatal', 'server-shutdown-failed', { error: serializeError(e) }),
    ),
  );

  // Unhandled errors
  process.on('unhandledRejection', reason =>
    gracefulShutdown('unhandledRejection', reason, 1).catch(e =>
      log('fatal', 'server-shutdown-failed', { error: serializeError(e) }),
    ),
  );
  process.on('uncaughtException', err =>
    gracefulShutdown('uncaughtException', err, 1).catch(e =>
      log('fatal', 'server-shutdown-failed', { error: serializeError(e) }),
    ),
  );

  server.listen(
    {
      port: 4000,
    },
    () => {
      log('info', 'server-listening', { url: 'http://localhost:4000/graphql' });
    },
  );
}

main();
