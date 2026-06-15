import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { TestDatabase } from './helpers/db-setup.js';
import { dropRlsRole, ensureRlsRole, runAsRlsRole } from './helpers/rls-role.js';

/**
 * Integration tests for the read side of RLS — the `USING` clause of the
 * `tenant_isolation` policy: `owner_id = ANY(get_current_business_scope())`.
 *
 * Companion to rls-write-target.integration.test.ts, which covers the write side
 * (`WITH CHECK`). Together they prove the policy is actually enforced at the DB
 * level, not merely defined — the test pool connects as postgres (BYPASSRLS), so
 * each SELECT-under-test runs under a non-superuser role (see helpers/rls-role.ts)
 * to make Postgres evaluate the policy and filter rows by the active read scope.
 */

// Two tenant businesses, distinct from the write-target fixtures so the two
// files can run against the same DB without interfering.
const A = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const B = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

// High, file-local key range to avoid colliding with other tests' sort_codes.
const KEY_A = 910_001;
const KEY_B = 910_002;

const GRANTS = [{ table: 'sort_codes', privileges: 'SELECT' }];

/** Read the sort_code keys visible under the current RLS context as the RLS role. */
async function visibleKeys(client: PoolClient): Promise<number[]> {
  return runAsRlsRole(client, async () => {
    const res = await client.query<{ key: number }>(
      `SELECT key FROM accounter_schema.sort_codes
       WHERE owner_id IN ($1, $2)
       ORDER BY key`,
      [A, B],
    );
    return res.rows.map(r => Number(r.key));
  });
}

describe('RLS read visibility: get_current_business_scope controls row filtering', () => {
  let db: TestDatabase;
  let pool: Pool;

  beforeAll(async () => {
    db = new TestDatabase();
    pool = await db.connect();

    await ensureRlsRole(pool, { grants: GRANTS });

    const setup = await pool.connect();
    try {
      // Fixture businesses A and B as self-owned entities, plus one sort_code
      // owned by each. Committed so they persist across rolled-back per-test txns.
      await setup.query('BEGIN');
      for (const id of [A, B]) {
        await setup.query(`SELECT set_config('app.current_business_id', $1, true)`, [id]);
        await setup.query(
          `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
           VALUES ($1, $2, $3, NULL)
           ON CONFLICT (id) DO NOTHING`,
          [id, id, 'business'],
        );
        await setup.query(
          `INSERT INTO accounter_schema.businesses (id, country, owner_id)
           VALUES ($1, $2, $1)
           ON CONFLICT (id) DO NOTHING`,
          [id, 'ISR'],
        );
        await setup.query(
          `UPDATE accounter_schema.financial_entities SET owner_id = $1 WHERE id = $1`,
          [id],
        );
      }
      await setup.query(
        `INSERT INTO accounter_schema.sort_codes (key, name, owner_id)
         VALUES ($1, 'rls-read-a', $2), ($3, 'rls-read-b', $4)
         ON CONFLICT (key, owner_id) DO NOTHING`,
        [KEY_A, A, KEY_B, B],
      );
      await setup.query('COMMIT');
    } catch (e) {
      try {
        await setup.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw e;
    } finally {
      setup.release();
    }
  });

  afterAll(async () => {
    const teardown = await pool.connect();
    try {
      await teardown.query('SET row_security = off');
      await teardown.query(
        `DELETE FROM accounter_schema.sort_codes WHERE owner_id IN ($1, $2)`,
        [A, B],
      );
      await teardown.query(
        `UPDATE accounter_schema.financial_entities SET owner_id = NULL WHERE id IN ($1, $2)`,
        [A, B],
      );
      await teardown.query(`DELETE FROM accounter_schema.businesses WHERE id IN ($1, $2)`, [A, B]);
      await teardown.query(`DELETE FROM accounter_schema.financial_entities WHERE id IN ($1, $2)`, [
        A,
        B,
      ]);
      await teardown.query('RESET row_security');
    } finally {
      teardown.release();
    }
    await dropRlsRole(pool, { grants: GRANTS });
    // Pool managed by global vitest setup — do not close here.
  });

  test('scope {A} sees only A’s rows, hiding B', async () => {
    await db.withTransaction(async client => {
      await client.query(
        `SELECT set_config('app.current_business_id', $1, true),
                set_config('app.current_business_scope', $2, true)`,
        [A, `{${A}}`],
      );
      expect(await visibleKeys(client)).toEqual([KEY_A]);
    });
  });

  test('scope {B} sees only B’s rows, hiding A', async () => {
    await db.withTransaction(async client => {
      await client.query(
        `SELECT set_config('app.current_business_id', $1, true),
                set_config('app.current_business_scope', $2, true)`,
        [B, `{${B}}`],
      );
      expect(await visibleKeys(client)).toEqual([KEY_B]);
    });
  });

  test('scope {A,B} sees both tenants’ rows (multi-business read scope)', async () => {
    await db.withTransaction(async client => {
      await client.query(
        `SELECT set_config('app.current_business_id', $1, true),
                set_config('app.current_business_scope', $2, true)`,
        [A, `{${A},${B}}`],
      );
      expect(await visibleKeys(client)).toEqual([KEY_A, KEY_B]);
    });
  });

  test('empty scope falls back to the single business context, hiding B', async () => {
    await db.withTransaction(async client => {
      // Scope unset → get_current_business_scope() returns [current_business_id].
      await client.query(
        `SELECT set_config('app.current_business_id', $1, true),
                set_config('app.current_business_scope', '', true)`,
        [A],
      );
      expect(await visibleKeys(client)).toEqual([KEY_A]);
    });
  });
});
