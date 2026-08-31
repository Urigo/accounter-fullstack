import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { seedAdminCore } from '../../scripts/seed-admin-context.js';
import { makeUUID } from '../demo-fixtures/helpers/deterministic-uuid.js';
import { TestDatabase } from './helpers/db-setup.js';
import { dropRlsRole, ensureRlsRole, RLS_TEST_ROLE, runAsRlsRole } from './helpers/rls-role.js';
import { withTestTransaction } from './helpers/test-transaction.js';

/**
 * Regression guard: the seed path must work on a NON-SUPERUSER connection.
 *
 * `seed-admin-context.integration.test.ts` already covers what seedAdminCore produces, but it
 * runs on the shared pool, which connects as `postgres` — a superuser, and therefore exempt
 * from RLS regardless of `FORCE ROW LEVEL SECURITY`. That is why an unpinned seed passed every
 * local and CI run for months and then failed on the first deployed run with
 * `P0001: No business context set - authentication required`, raised from
 * `accounter_schema.get_current_business_id()` while evaluating `tenant_isolation`.
 *
 * These two cases close that gap by dropping to a non-superuser role (see helpers/rls-role.ts)
 * so Postgres actually evaluates the policies:
 *   - with the RLS context pinned, seedAdminCore succeeds;
 *   - without it, seedAdminCore fails with exactly the deploy's error.
 *
 * The negative case is the one that would have caught the outage.
 */

/** Derived exactly as seedAdminCore derives it — the seed scripts pin the context to this. */
const ADMIN_BUSINESS_ID = makeUUID('business', 'Admin Business');

/**
 * Everything seedAdminCore writes. `financial_entities` needs UPDATE as well as INSERT: its
 * upsert is `ON CONFLICT (id) DO UPDATE`, and seedAdminCore also self-owns the admin row with
 * an explicit UPDATE. The rest use `ON CONFLICT DO NOTHING` and only pre-check with a SELECT.
 * `countries` carries no RLS, but the role still needs the privilege to run the statement.
 */
const SEED_GRANTS = [
  { table: 'countries', privileges: 'INSERT, SELECT' },
  { table: 'financial_entities', privileges: 'INSERT, UPDATE, SELECT' },
  { table: 'businesses', privileges: 'INSERT, SELECT' },
  { table: 'tax_categories', privileges: 'INSERT, SELECT' },
  { table: 'user_context', privileges: 'INSERT, SELECT' },
];

describe('seedAdminCore under RLS (non-superuser connection)', () => {
  let db: TestDatabase;
  let pool: Pool;

  beforeAll(async () => {
    db = new TestDatabase();
    pool = await db.connect();

    await ensureRlsRole(pool, { grants: SEED_GRANTS });
    // user_context and tax_categories carry identity/serial columns in places; without this the
    // role fails on the sequence rather than on the policy, which would mask what we assert.
    await pool.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA accounter_schema TO ${RLS_TEST_ROLE}`,
    );
  });

  afterAll(async () => {
    if (pool) await dropRlsRole(pool);
    // Pool is managed by the global vitest setup — do not close it here.
  });

  it('succeeds when app.current_business_id is pinned to the admin business', () =>
    withTestTransaction(pool, async client => {
      // Set the context as superuser, BEFORE dropping privileges (see rls-role.ts). The admin
      // entity need not exist yet: `allow_bootstrap_root` on financial_entities permits an
      // insert whose id equals the current business context even with owner_id NULL.
      await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [
        ADMIN_BUSINESS_ID,
      ]);

      const { adminEntityId } = await runAsRlsRole(client, () => seedAdminCore(client));

      expect(adminEntityId).toBe(ADMIN_BUSINESS_ID);

      const seeded = await client.query(
        `SELECT owner_id FROM accounter_schema.financial_entities WHERE id = $1`,
        [ADMIN_BUSINESS_ID],
      );
      expect(seeded.rows).toHaveLength(1);
      expect(seeded.rows[0].owner_id).toBe(ADMIN_BUSINESS_ID);
    }));

  it('fails with P0001 when no business context is set', () =>
    withTestTransaction(pool, async client => {
      // Clear explicitly rather than relying on the GUC being unset: a pooled connection may
      // carry a value from earlier work, and get_current_business_id() NULLIFs the empty string,
      // so '' reproduces "never set" deterministically.
      await client.query(`SELECT set_config('app.current_business_id', '', true)`);

      await expect(runAsRlsRole(client, () => seedAdminCore(client))).rejects.toMatchObject({
        // seedAdminCore wraps the driver error; the P0001 is the cause.
        cause: expect.objectContaining({
          code: 'P0001',
          message: expect.stringContaining('No business context set'),
        }),
      });
    }));
});
