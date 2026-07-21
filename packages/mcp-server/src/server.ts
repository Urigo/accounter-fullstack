import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { env } from './config/env.js';
import { createRequestContext, elapsedMs, setRequestContext } from './context.js';
import { completionFields, createRequestLogger, log } from './logger.js';
import { mcpHttpHandler } from './mcp/handler.js';
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

export async function requestHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const context = createRequestContext(req);
  setRequestContext(req, context);
  const logger = createRequestLogger(context);

  // Echo the correlation id so callers can tie their logs to ours.
  res.setHeader('X-Correlation-Id', context.correlationId);

  logger.info('request started');
  // Log completion on `close` (not `finish`) so an aborted/prematurely-closed
  // connection still emits a completion log instead of a silent blind spot.
  res.once('close', () => {
    logger.info('request completed', completionFields(context, res.statusCode));
  });

  try {
    const handler = routes[context.method]?.[context.route];
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
      clearTimeout(forceTimer);
      if (error) {
        log('error', 'error during shutdown', { error: String(error) });
        exit(1);
        return;
      }
      log('info', 'shutdown complete', { signal });
      exit(0);
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
    log('info', 'mcp server started', {
      service: SERVICE_NAME,
      version: getServiceVersion(),
      port: env.server.port,
      enabled: env.server.enabled,
    });
  });

  return server;
}
