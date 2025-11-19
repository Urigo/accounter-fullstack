import { Pool, type PoolClient } from 'pg';
import { createPool as createSlonikPool, type DatabasePool } from 'slonik';
import { testDbConfig, testDbSchema } from './test-db-config.js';
import { runPGMigrations } from '../../../../migrations/src/run-pg-migrations.js';
import { seedAdminCore } from '../../../scripts/seed-admin-context.js';

// Track if migrations have been run in this process
let migrationsComplete = false;
// Track if admin context has been seeded in this process
let adminSeeded = false;
// Shared connection pool instance
let sharedPool: Pool | null = null;

/**
 * Create or return existing PostgreSQL connection pool for tests
 * Uses shared pool to avoid connection exhaustion
 * 
 * @returns PostgreSQL connection pool
 * 
 * @example
 * ```typescript
 * const pool = await connectTestDb();
 * const client = await pool.connect();
 * try {
 *   await client.query('SELECT 1');
 * } finally {
 *   client.release();
 * }
 * ```
 */
export async function connectTestDb(): Promise<Pool> {
  if (sharedPool) {
    return sharedPool;
  }

  sharedPool = new Pool({
    ...testDbConfig,
    // Limit connections for test environment
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Verify connection
  const client = await sharedPool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }

  return sharedPool;
}

/**
 * Run database migrations if not already executed in this process
 * Idempotent - safe to call multiple times
 * Uses in-memory flag to prevent redundant migration runs within same process
 * 
 * @param pool - Optional PostgreSQL pool (creates one if not provided)
 * @returns Promise resolving when migrations complete
 * 
 * @example
 * ```typescript
 * const pool = await connectTestDb();
 * await runMigrationsIfNeeded(pool);
 * // Schema is now at latest version
 * ```
 */
export async function runMigrationsIfNeeded(pool?: Pool): Promise<void> {
  if (migrationsComplete) {
    return;
  }

  const pgPool = pool ?? (await connectTestDb());

  // Create slonik pool from pg pool config
  // Note: Migrations use slonik, tests use pg - need to bridge
  const slonikPool: DatabasePool = await createSlonikPool(
    `postgres://${testDbConfig.user}:${testDbConfig.password}@${testDbConfig.host}:${testDbConfig.port}/${testDbConfig.database}`,
    {
      // Match migration timeout from migrations/src/index.ts
      statementTimeout: 10 * 60 * 1000, // 10 minutes
    },
  );

  try {
    await runPGMigrations({ slonik: slonikPool });
    migrationsComplete = true;
  } finally {
    // Close slonik pool after migrations
    await slonikPool.end();
  }
}

/**
 * Seed admin context (admin business, authorities, tax categories) if not already done
 * Idempotent at both process-level (in-memory flag) and database-level (seedAdminCore logic)
 * 
 * Process-level lock: Prevents redundant calls within same test run
 * Database-level lock: Prevents duplicate data if called from different processes
 * 
 * @param pool - Optional PostgreSQL pool (creates one if not provided)
 * @returns Promise resolving when admin context is ready
 * 
 * @example
 * ```typescript
 * const pool = await connectTestDb();
 * await runMigrationsIfNeeded(pool);
 * await seedAdminOnce(pool);
 * // Admin business, 3 authorities, 19 tax categories, user_context now exist
 * ```
 */
export async function seedAdminOnce(pool?: Pool): Promise<void> {
  if (adminSeeded) {
    return;
  }

  const pgPool = pool ?? (await connectTestDb());

  // Get a client from the pool
  const client = await pgPool.connect();
  try {
    // seedAdminCore requires a PoolClient
    await seedAdminCore(client);
  } finally {
    client.release();
  }

  adminSeeded = true;
}

/**
 * Close the shared connection pool
 * Should be called in global teardown to prevent hanging connections
 * 
 * @example
 * ```typescript
 * // In vitest.config.ts globalTeardown
 * import { closeTestDb } from './src/__tests__/helpers/db-setup';
 * 
 * export default async function teardown() {
 *   await closeTestDb();
 * }
 * ```
 */
export async function closeTestDb(): Promise<void> {
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = null;
  }
  // Reset flags for clean state
  migrationsComplete = false;
  adminSeeded = false;
}

/**
 * Reset process-level migration/seed flags
 * Useful for testing the setup functions themselves
 * 
 * @internal
 */
export function resetSetupFlags(): void {
  migrationsComplete = false;
  adminSeeded = false;
}

// Re-export transaction utilities from test-transaction.ts
// Provides single import point for all DB test utilities
export { withTestTransaction, withConcurrentTransactions } from './test-transaction.js';
