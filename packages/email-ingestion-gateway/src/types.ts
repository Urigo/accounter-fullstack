export type { Environment } from './environment.js';

export type JsonObject = Record<string, unknown>;

export interface HealthResponse {
  status: 'ok';
}
