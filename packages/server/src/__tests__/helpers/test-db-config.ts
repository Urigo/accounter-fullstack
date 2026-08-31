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

/**
 * Refuse to let the test harness touch a deployed database.
 *
 * Called from the places that actually open a connection, NOT at module scope. This module
 * also exports `qualifyTable`, a pure string helper, and asserting on import meant that
 * merely importing that helper could abort an unrelated process: `scripts/seed-demo-data.ts`
 * imports `fixture-loader.ts`, which imports `qualifyTable` from here, and that chain broke
 * a staging deploy with a "the test harness" error while seeding. Importing a utility is not
 * evidence that anyone is about to run tests -- connecting is.
 *
 * Tests must never target a deployed database, so this refuses rather than warns; override
 * POSTGRES_* for the command, or set ALLOW_REMOTE_DB=1 if you really mean it.
 */
export function assertTestDatabaseIsLocal(): void {
  assertLocalDatabase(
    {
      host: testDbConfig.host,
      port: testDbConfig.port,
      db: testDbConfig.database,
      user: testDbConfig.user,
    },
    'the test harness',
  );
}

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
