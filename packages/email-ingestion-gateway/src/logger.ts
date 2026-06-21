/* eslint-disable no-console */
import { randomUUID } from 'node:crypto';
import type { LogEntry, LogLevel } from './types.js';

export function generateCorrelationId(): string {
  return randomUUID();
}

export function log(
  level: LogLevel,
  message: string,
  fields?: Record<string, unknown>,
  correlationId?: string,
): void {
  const entry: LogEntry = {
    ...fields,
    timestamp: new Date().toISOString(),
    level,
    ...(correlationId !== undefined && { correlationId }),
    message,
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}
