import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Pool, PoolClient } from 'pg';
import { connectTestDb, closeTestDb } from './db-connection.js';

let pool: Pool;
let client: PoolClient | null = null;
let seeded = false;

/**
 * Sets up Vitest lifecycle hooks for transactional isolation.
 * - Creates isolated temp env file if TEST_ENV_FILE not set.
 * - Connects a shared pool once.
 * - Opens a fresh transaction before each test and rolls back after.
 * - Optionally seeds the admin core inside each test transaction (idempotent).
 *
 * NOTE: Migrations are expected to be applied externally; this helper only asserts runtime isolation.
 */
export function setupDbHooks(options: { seedAdminInEachTest?: boolean } = {}) {
  const { seedAdminInEachTest = false } = options;

  // Dynamically register hooks (Vitest provides global beforeAll/afterAll etc.)
  // We avoid importing from 'vitest' here to keep file usable outside tests if needed.
  // Vitest will inject these globals.
  // @ts-ignore - Provided by Vitest runtime
  beforeAll(async () => {
    // Ensure isolated env file
    if (!process.env.TEST_ENV_FILE) {
      const dir = mkdtempSync(join(tmpdir(), 'accounter-env-'));
      const envPath = join(dir, '.env');
      writeFileSync(envPath, '');
      process.env.TEST_ENV_FILE = envPath;
    }
    // Always log path for acceptance visibility
    // eslint-disable-next-line no-console
    console.log(`[test-hooks] Using TEST_ENV_FILE: ${process.env.TEST_ENV_FILE}`);
    pool = await connectTestDb();
  });

  // @ts-ignore
  beforeEach(async () => {
    client = await pool.connect();
    await client.query('BEGIN');
    if (seedAdminInEachTest && !seeded) {
      try {
        const { seedAdminCore } = await import(
          '../../../scripts/seed-admin-context.js'
        );
        await seedAdminCore(client); // idempotent seeding inside transaction
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed seeding admin core inside test transaction', err);
        throw err;
      }
      seeded = true; // prevent re-running in subsequent tests (still within transaction scope)
    }
  });

  // @ts-ignore
  afterEach(async () => {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } finally {
        client.release();
        client = null;
      }
    }
  });

  // @ts-ignore
  afterAll(async () => {
    await closeTestDb();
  });
}

/** Access the active transactional client for the current test. */
export function getTestClient(): PoolClient {
  if (!client) throw new Error('No active test client (transaction not started)');
  return client;
}

/** Access the underlying shared pool. */
export function getTestPool(): Pool {
  if (!pool) throw new Error('Test pool not initialized');
  return pool;
}
