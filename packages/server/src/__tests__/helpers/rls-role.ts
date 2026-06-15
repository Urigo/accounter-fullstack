import type { Pool, PoolClient } from 'pg';

/**
 * Shared utilities for exercising Row-Level Security (RLS) in integration tests.
 *
 * The test pool connects as `postgres`, a superuser with BYPASSRLS, so any query
 * run as postgres bypasses RLS regardless of `FORCE ROW LEVEL SECURITY`. To make
 * Postgres actually evaluate the `tenant_isolation` policies (USING for reads,
 * WITH CHECK for writes) a test must run the queries-under-test as a non-superuser
 * role. These helpers create that role and confine the privilege drop to a
 * SAVEPOINT so the surrounding test transaction stays usable.
 *
 * This is the same boundary the tenant-bound providers rely on at runtime, so
 * future tenant-scoped providers can reuse it rather than re-deriving the
 * role-switch mechanics.
 */

const SCHEMA = 'accounter_schema';

/**
 * Per-process unique role name. Avoids collisions when Vitest runs test files in
 * parallel workers (each worker is a separate process).
 */
export const RLS_TEST_ROLE = `rls_test_user_${process.pid}`;

/** A table privilege grant: e.g. `{ table: 'sort_codes', privileges: 'INSERT, SELECT' }`. */
export interface RlsRoleGrant {
  /** Unqualified table name (schema prefix is added automatically). */
  table: string;
  /** Comma-separated SQL privileges, e.g. `'SELECT'` or `'INSERT, SELECT'`. */
  privileges: string;
}

export interface RlsRoleOptions {
  /** Table privileges to grant the role for the queries under test. */
  grants?: RlsRoleGrant[];
}

/**
 * Idempotently create the per-process non-superuser RLS role and grant it schema
 * usage plus any requested table privileges.
 *
 * `CREATE ROLE` / `GRANT` are not meant to be rolled back per-test, so this runs
 * on its own connection outside any test transaction. Call from `beforeAll` and
 * pair with {@link dropRlsRole} in `afterAll`.
 */
export async function ensureRlsRole(pool: Pool, options: RlsRoleOptions = {}): Promise<void> {
  const client = await pool.connect();
  try {
    // CREATE ROLE is not transactional — guard against re-create across workers.
    await client.query(
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RLS_TEST_ROLE}') THEN
           CREATE ROLE ${RLS_TEST_ROLE} LOGIN PASSWORD 'unused';
         END IF;
       END $$`,
    );
    await client.query(`GRANT USAGE ON SCHEMA ${SCHEMA} TO ${RLS_TEST_ROLE}`);
    for (const { table, privileges } of options.grants ?? []) {
      await client.query(`GRANT ${privileges} ON ${SCHEMA}.${table} TO ${RLS_TEST_ROLE}`);
    }
  } finally {
    client.release();
  }
}

/** Revoke grants and drop the per-process RLS role. Mirror of {@link ensureRlsRole}. */
export async function dropRlsRole(pool: Pool, options: RlsRoleOptions = {}): Promise<void> {
  const client = await pool.connect();
  try {
    for (const { table, privileges } of options.grants ?? []) {
      await client.query(`REVOKE ${privileges} ON ${SCHEMA}.${table} FROM ${RLS_TEST_ROLE}`);
    }
    await client.query(`REVOKE USAGE ON SCHEMA ${SCHEMA} FROM ${RLS_TEST_ROLE}`);
    await client.query(`DROP ROLE IF EXISTS ${RLS_TEST_ROLE}`);
  } finally {
    client.release();
  }
}

/**
 * Run `fn` with the connection's role dropped to the non-superuser RLS role, so
 * Postgres evaluates the RLS policies. The role switch is confined to a SAVEPOINT:
 * on success the role is reset and the savepoint released; on any error the
 * savepoint is rolled back (which also restores the original role) and the error
 * is rethrown for the caller to interpret (e.g. `42501` = WITH CHECK rejection).
 *
 * Set the relevant `app.*` session variables BEFORE calling this — as superuser,
 * before privileges are dropped.
 */
export async function runAsRlsRole<T>(client: PoolClient, fn: () => Promise<T>): Promise<T> {
  await client.query(`SAVEPOINT rls_role`);
  try {
    await client.query(`SET LOCAL ROLE ${RLS_TEST_ROLE}`);
    const result = await fn();
    await client.query(`RESET ROLE`);
    await client.query(`RELEASE SAVEPOINT rls_role`);
    return result;
  } catch (err) {
    await client.query(`ROLLBACK TO SAVEPOINT rls_role`);
    throw err;
  }
}
