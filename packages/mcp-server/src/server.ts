import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { trace } from '@opentelemetry/api';
import { env } from './config/env.js';
import { createRequestContext, elapsedMs, setRequestContext } from './context.js';
import { completionFields, createRequestLogger, log } from './logger.js';
import { mcpHttpHandler } from './mcp/handler.js';
import {
  buildProtectedResourceMetadata,
  PROTECTED_RESOURCE_METADATA_PATH,
} from './oauth/metadata.js';
import { getMetrics } from './observability/metrics.js';
import { CORRELATION_ID_ATTRIBUTE } from './observability/tracing.js';
import { shutdownTelemetry } from './telemetry/index.js';
import { getServiceVersion, SERVICE_NAME } from './version.js';

/**
 * HTTP server bootstrap for the MCP server.
 *
 * Provides a plain `node:http` server with a `/health` endpoint, the MCP
 * transport route (`POST /mcp`), and graceful shutdown. Kept dependency-free
 * (stdlib only) to avoid runtime framework lock-in.
 */

export { getServiceVersion, SERVICE_NAME } from './version.js';

export interface HealthBody {
  status: 'ok';
  service: string;
  version: string;
  uptimeSeconds: number;
}

export function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

export const MCP_ROUTE_PATH = '/mcp';

/**
 * Normalize a request path for routing: strip a single-or-repeated trailing
 * slash so a correct-looking URL such as `/mcp/` matches the `/mcp` route
 * instead of silently 404ing. The root path `/` is preserved as-is.
 *
 * This runs before route lookup so a trailing slash reaches the same handler
 * (and, for `/mcp`, the auth layer and metrics) as the canonical path — a
 * trailing-slash 404 never reaches auth, so it records nothing and looks like
 * an outage rather than a typo.
 */
export function normalizeRoutePath(route: string): string {
  return route.length > 1 ? route.replace(/\/+$/, '') || '/' : route;
}

export const routes: Record<string, Record<string, RouteHandler>> = {
  GET: {
    '/health': (_req, res) => {
      const body: HealthBody = {
        status: 'ok',
        service: SERVICE_NAME,
        version: getServiceVersion(),
        uptimeSeconds: Math.round(process.uptime()),
      };
      sendJson(res, 200, body);
    },
    // Operational metrics snapshot (counters + latency histogram).
    '/metrics': (_req, res) => {
      sendJson(res, 200, getMetrics().snapshot());
    },
    // OAuth 2.0 Protected Resource Metadata (RFC 9728) — lets Claude clients
    // discover the Auth0 authorization server for this resource.
    [PROTECTED_RESOURCE_METADATA_PATH]: (_req, res) => {
      const body = buildProtectedResourceMetadata({
        resource: env.server.publicBaseUrl,
        authorizationServers: [env.auth0.issuerUrl],
      });
      sendJson(res, 200, body);
    },
    // Streamable HTTP's optional GET (server-initiated SSE stream) is not
    // supported in this phase — respond deterministically.
    [MCP_ROUTE_PATH]: (_req, res) => {
      res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    },
  },
  POST: {
    [MCP_ROUTE_PATH]: mcpHttpHandler,
  },
};

/**
 * Monotonic (process-relative, from `performance.now()`) timestamp of the last
 * request seen by this process, for the idle-gap marker below. Not wall-clock —
 * only differences within this process are meaningful. Process-local and
 * best-effort (not synchronized across concurrent requests); it exists to make
 * idle periods and cold starts visible in the logs, not to be exact.
 */
let lastRequestAtMs: number | undefined;

export async function requestHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const context = createRequestContext(req);
  setRequestContext(req, context);
  const logger = createRequestLogger(context);

  // Idle-gap marker: how long since this process last saw a request. `undefined`
  // on the very first request of a process — which, paired with the startup log,
  // is itself the cold-start signal. A large gap here after a quiet period is
  // what an idle spin-down + cold start looks like from inside the app.
  const nowMs = performance.now();
  const msSinceLastRequest =
    lastRequestAtMs === undefined ? undefined : Math.round(nowMs - lastRequestAtMs);
  lastRequestAtMs = nowMs;

  // Tag the auto-instrumented incoming HTTP span with the business-level
  // correlation id (and request id) so this MCP trace — and, via `traceparent`
  // propagation, the backend trace it triggers — are both searchable by the
  // same `X-Correlation-Id` in Grafana. A no-op when telemetry is disabled.
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.setAttribute(CORRELATION_ID_ATTRIBUTE, context.correlationId);
    activeSpan.setAttribute('accounter.request_id', context.requestId);
  }

  // Echo the correlation id so callers can tie their logs to ours.
  res.setHeader('X-Correlation-Id', context.correlationId);

  logger.info(
    'request started',
    msSinceLastRequest === undefined ? undefined : { msSinceLastRequest },
  );
  // Log completion on `close` (not `finish`) so an aborted/prematurely-closed
  // connection still emits a completion log instead of a silent blind spot.
  // `aborted`/`responseCompleted` make that distinction explicit, and
  // `uptimeSeconds` surfaces restart/cold-start churn.
  res.once('close', () => {
    logger.info(
      'request completed',
      completionFields(context, res.statusCode, {
        // `writableFinished` (fully flushed), not `writableEnded` (end() called):
        // a client that hangs up after end() but before the flush completes is a
        // mid-flight disconnect, and must not be logged as completed.
        responseCompleted: res.writableFinished,
        aborted: !res.writableFinished,
        uptimeSeconds: Math.round(process.uptime()),
      }),
    );
  });

  try {
    // Tolerate a trailing slash (e.g. `/mcp/`) so the request is dispatched to
    // the same handler as its canonical path. `context.route` keeps the raw
    // pathname for logging fidelity; only routing uses the normalized form.
    const route = normalizeRoutePath(context.route);
    // Kill-switch: when MCP is disabled the server serves health only, so the
    // MCP transport and its OAuth resource-metadata discovery route are treated
    // as absent (404) rather than being advertised/served.
    const isMcpRoute = route === MCP_ROUTE_PATH || route === PROTECTED_RESOURCE_METADATA_PATH;
    const handler = isMcpRoute && !env.server.enabled ? undefined : routes[context.method]?.[route];
    if (handler) {
      await handler(req, res);
    } else {
      sendJson(res, 404, { error: 'Not found' });
    }
  } catch (error) {
    logger.error('request failed', {
      error: String(error),
      latencyMs: elapsedMs(context),
    });
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Internal server error' });
    }
  }
}

export function createHttpServer(): Server {
  return createServer(requestHandler);
}

/** Milliseconds to wait for in-flight requests before forcing exit. */
export const SHUTDOWN_GRACE_MS = 10_000;

export interface ShutdownDeps {
  server: Server;
  exit?: (code: number) => void;
  graceMs?: number;
}

/**
 * Build a signal handler that closes the server, then exits. Extracted as a
 * factory so shutdown behavior is unit-testable without real signals.
 */
export function createShutdownHandler({
  server,
  exit = code => process.exit(code),
  graceMs = SHUTDOWN_GRACE_MS,
}: ShutdownDeps): (signal: string) => void {
  let shuttingDown = false;
  return (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    log('info', 'shutdown signal received', { signal });

    const forceTimer = setTimeout(() => {
      log('warn', 'graceful shutdown timed out, forcing exit', { graceMs });
      exit(1);
    }, graceMs);
    forceTimer.unref?.();

    server.close(error => {
      // Flush pending spans before exiting so in-flight traces are not dropped.
      // A no-op when telemetry was never started (OTEL disabled). Keep the grace
      // timer armed across the flush so a stalled exporter can't hang shutdown
      // indefinitely — clear it only once we're actually about to exit.
      void shutdownTelemetry().finally(() => {
        clearTimeout(forceTimer);
        if (error) {
          log('error', 'error during shutdown', { error: String(error) });
          exit(1);
          return;
        }
        log('info', 'shutdown complete', { signal });
        exit(0);
      });
    });

    // `server.close()` stops accepting new connections but leaves idle
    // keep-alive sockets open, which can stall shutdown until the grace timer
    // fires. Close idle connections immediately so shutdown completes promptly.
    server.closeIdleConnections?.();
  };
}

/**
 * Start the HTTP server: validate config (via the imported `env`), bind the
 * port, and register graceful-shutdown signal handlers.
 */
export function start(): Server {
  if (!env.server.enabled) {
    log('warn', 'MCP_ENABLED=0 — server is starting in disabled mode (health only)');
  }

  const server = createHttpServer();
  const shutdown = createShutdownHandler({ server });

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  server.listen(env.server.port, () => {
    // `pid` tags this process instance so restarts are distinguishable in
    // aggregated logs; each `mcp server started` line marks a fresh (cold)
    // start of the transport.
    log('info', 'mcp server started', {
      service: SERVICE_NAME,
      version: getServiceVersion(),
      port: env.server.port,
      enabled: env.server.enabled,
      pid: process.pid,
    });
  });

  return server;
}
