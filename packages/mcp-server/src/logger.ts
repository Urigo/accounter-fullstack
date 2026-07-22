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

/** Log fields describing request completion, including latency. */
export function completionFields(context: RequestContext, status: number): Record<string, unknown> {
  return { status, latencyMs: elapsedMs(context) };
}
