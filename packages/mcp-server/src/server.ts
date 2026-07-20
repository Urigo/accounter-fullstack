import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { log } from './logger.js';

/**
 * HTTP server bootstrap for the MCP server.
 *
 * Provides a plain `node:http` server with a `/health` endpoint and graceful
 * shutdown. No MCP protocol logic lives here yet — the MCP transport route is
 * added in a later step. Kept dependency-free (stdlib only) to avoid runtime
 * framework lock-in.
 */

export const SERVICE_NAME = '@accounter/mcp-server';

let cachedVersion: string | undefined;

/**
 * Resolve the package version at runtime without importing outside `rootDir`.
 * The result is cached: the version cannot change while the process runs, so
 * we avoid a synchronous disk read on every `/health` request.
 */
export function getServiceVersion(): string {
  if (cachedVersion !== undefined) {
    return cachedVersion;
  }
  try {
    const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: string };
    cachedVersion = parsed.version ?? '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}

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
  },
};

export async function requestHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Only the pathname matters for routing; the host is a placeholder so we never
  // need to read config here.
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    const handler = routes[req.method ?? '']?.[url.pathname];
    if (handler) {
      await handler(req, res);
    } else {
      sendJson(res, 404, { error: 'Not found' });
    }
  } catch (error) {
    log('error', 'unhandled request error', { error: String(error), path: url.pathname });
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
