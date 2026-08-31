import type { PoolConfig } from 'pg';
import { config } from 'dotenv';
import { assertLocalDatabase } from '../../../../migrations/src/local-db-guard.js';

// Load environment variables
config({ path: [`.env`, `../../.env`] });

/**
 * Shared database configuration for test environments
 * Uses environment variables with sensible defaults for local development
 */
export const testDbConfig: PoolConfig = {
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'accounter_test',
  ssl: process.env.POSTGRES_SSL === '1',
};

// Fail at import time rather than at first query. Every DB-backed test helper builds its
// pool from `testDbConfig`, so this one call covers the whole harness -- including the
// vitest global setup, which writes reference data before any test file is loaded.
// Tests must never touch a deployed database; override POSTGRES_* or set ALLOW_REMOTE_DB=1.
assertLocalDatabase(
  {
    host: testDbConfig.host,
    port: testDbConfig.port,
    db: testDbConfig.database,
    user: testDbConfig.user,
  },
  'the test harness',
);

/**
 * Database schema name for queries
 * Allows tests to run in isolated schemas if needed
 */
export const testDbSchema = process.env.POSTGRES_SCHEMA || 'accounter_schema';

/**
 * Helper to build fully-qualified table name
 * @param tableName - Unqualified table name
 * @returns Fully qualified table name with schema prefix
 */
export function qualifyTable(tableName: string): string {
  return `${testDbSchema}.${tableName}`;
}
