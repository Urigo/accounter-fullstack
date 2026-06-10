export type { Environment } from './environment.js';

export type JsonObject = Record<string, unknown>;

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  correlationId?: string;
  message: string;
  [key: string]: unknown;
}

export interface HealthResponse {
  status: 'ok';
}

export interface ReadinessResponse {
  ready: true;
}
