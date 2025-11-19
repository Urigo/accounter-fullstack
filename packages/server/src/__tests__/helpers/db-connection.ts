import { Pool } from 'pg';
import { testDbConfig } from './test-db-config.js';
import { debugLog, emitMetrics } from './diagnostics.js';
import { TestDbConnectionError } from './errors.js';

let sharedPool: Pool | null = null;

export function getSharedPool(): Pool | null {
  return sharedPool;
}

export async function connectTestDb(): Promise<Pool> {
  if (sharedPool) return sharedPool;

  const createPool = () =>
    new Pool({
      ...testDbConfig,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

  const attempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      sharedPool = createPool();
      const client = await sharedPool.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }
      debugLog('Connected to test DB on attempt', attempt);
      emitMetrics('connected', sharedPool);
      return sharedPool;
    } catch (error) {
      lastError = error;
      debugLog('DB connect attempt failed', attempt, error);
      if (sharedPool) {
        try {
          await sharedPool.end();
        } catch {}
        sharedPool = null;
      }
      if (attempt < attempts) await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }

  throw new TestDbConnectionError('Failed to connect to test database after retries', lastError);
}

export async function closeTestDb(): Promise<void> {
  if (sharedPool) {
    emitMetrics('closing', sharedPool);
    await sharedPool.end();
    sharedPool = null;
  }
}
