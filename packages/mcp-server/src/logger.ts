/* eslint-disable no-console */

/**
 * Minimal structured logger for the MCP server.
 *
 * Emits single-line JSON so logs are machine-parseable in production. This is a
 * deliberately small foundation; request-context propagation (correlation ids,
 * per-request child loggers) is layered on in a later step. Secrets and
 * authorization headers must never be passed as fields.
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
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}
