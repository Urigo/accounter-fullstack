/* eslint-disable no-console */
import type { RequestContext } from './context.js';
import { elapsedMs } from './context.js';

/**
 * Minimal structured logger for the MCP server.
 *
 * Emits single-line JSON so logs are machine-parseable in production. Secrets
 * and authorization headers must never be passed as fields.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

export function log(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  const entry: LogEntry = {
    ...fields,
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  try {
    const line = JSON.stringify(entry);
    if (level === 'error') {
      console.error(line);
    } else {
      console.log(line);
    }
  } catch (error) {
    // Never let a non-serializable field (circular ref, BigInt, …) crash the
    // process — this logger runs inside global error handlers.
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'failed to serialize log entry',
        originalMessage: message,
        error: String(error),
      }),
    );
  }
}

/** Structured fields derived from a request context (no secrets/headers). */
export function contextFields(context: RequestContext): Record<string, unknown> {
  return {
    requestId: context.requestId,
    correlationId: context.correlationId,
    method: context.method,
    route: context.route,
  };
}

export interface RequestLogger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

/**
 * A logger bound to a request context. Every entry automatically carries the
 * request id, correlation id, method, and route.
 */
export function createRequestLogger(context: RequestContext): RequestLogger {
  const base = contextFields(context);
  const emit = (level: LogLevel) => (message: string, fields?: Record<string, unknown>) =>
    log(level, message, { ...base, ...fields });
  return {
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
  };
}

/**
 * Extra completion fields the transport supplies from the response/process so a
 * disconnect is diagnosable after the fact.
 *
 * - `responseCompleted` — the response fully finished flushing to the socket
 *   (`res.writableFinished`, not merely `end()` having been called).
 * - `aborted` — the connection closed before the response finished flushing,
 *   i.e. the client hung up mid-flight (the server-side fingerprint of a
 *   client-side timeout, such as a request abandoned during a cold start).
 * - `uptimeSeconds` — process uptime at completion; a value that keeps resetting
 *   to near-zero across requests reveals an instance that is restarting/cold
 *   starting rather than staying warm.
 */
export interface CompletionExtra {
  responseCompleted?: boolean;
  aborted?: boolean;
  uptimeSeconds?: number;
}

/**
 * Log fields describing request completion, including latency. `extra` is
 * spread first so the canonical `status`/`latencyMs` always win — a caller
 * cannot accidentally emit a completion log with an overridden status.
 */
export function completionFields(
  context: RequestContext,
  status: number,
  extra?: CompletionExtra,
): Record<string, unknown> {
  return { ...extra, status, latencyMs: elapsedMs(context) };
}
